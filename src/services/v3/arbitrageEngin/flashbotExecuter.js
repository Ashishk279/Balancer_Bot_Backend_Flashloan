import { ethers } from 'ethers';
import { FlashbotsBundleProvider, FlashbotsBundleResolution } from '@flashbots/ethers-provider-bundle';
import logger from '../../../utils/logger.js';
import ABI from '../abi/abi.js';

class FlashbotExecutor {
  constructor(provider, wallet, options = {}) {
    this.provider = provider;
    this.wallet = wallet;
    this.contractAddress = options.contractAddress || process.env.ARBITRAGE_CONTRACT_ADDRESS;
    this.relayUrl = options.flashbotsRelay || 'https://relay.flashbots.net';
    this.contract = new ethers.Contract(this.contractAddress, ABI, wallet);
    this.flashbotsProvider = null;
    this.initialized = false;
    this.nonceManager = {
      localNonce: null,
      lastUpdate: 0
    };
  }

  async initialize() {
    try {
      const network = await this.provider.getNetwork();
      logger.info(`Initializing on Chain ID: ${network.chainId}`, { service: 'flashbotExecutorV3' });
      
      // Flashbots only works on Ethereum mainnet (chainId: 1)
      if (network.chainId !== 1n) {
        throw new Error(`Flashbots only supports Ethereum mainnet. Current chainId: ${network.chainId}`);
      }

      this.flashbotsProvider = await FlashbotsBundleProvider.create(
        this.provider, 
        this.wallet, 
        this.relayUrl
      );
      
      this.initialized = true;
      logger.info('✅ FlashbotExecutorV3 initialized successfully', { service: 'flashbotExecutorV3' });
    } catch (error) {
      logger.error(`❌ Failed to initialize FlashbotExecutorV3: ${error.message}`, { 
        service: 'flashbotExecutorV3' 
      });
      throw error;
    }
  }

  encodeCallData(opportunity) {
    const { execution_payload: payload, type } = opportunity;
    const deadline = payload.deadline || Math.floor(Date.now() / 1000) + 120; // 2 minutes
    
    try {
      let callData;

      if (type === 'v3_triangular' || payload.loanAmount) {
        // Flash loan arbitrage
        const path = payload.path.map(step => ({
          router: step.router || ethers.ZeroAddress,
          tokenIn: step.tokenIn || ethers.ZeroAddress,
          tokenOut: step.tokenOut || ethers.ZeroAddress,
          dexType: step.dexType || 0,
          fee: step.fee || 3000,
          minAmountOut: step.minAmountOut || 0
        }));

        callData = this.contract.interface.encodeFunctionData('flashArbitrage', [
          path,
          payload.loanToken || ethers.ZeroAddress,
          ethers.parseUnits((payload.loanAmount || '0').toString(), 18),
          ethers.parseUnits((payload.minProfit || opportunity.estimated_profit || '0').toString(), 18),
          deadline,
        ]);
      } else {
        // Regular arbitrage
        const path = payload.path.map(step => ({
          router: step.router || ethers.ZeroAddress,
          tokenIn: step.tokenIn || ethers.ZeroAddress,
          tokenOut: step.tokenOut || ethers.ZeroAddress,
          dexType: step.dexType || 0,
          fee: step.fee || 3000,
          minAmountOut: step.minAmountOut || 0,
        }));

        callData = this.contract.interface.encodeFunctionData('executeArbitrage', [
          path,
          payload.amountIn,
          payload.minProfit,
          deadline,
        ]);
      }

      logger.info('📝 CallData encoded successfully', { service: 'flashbotExecutorV3' });
      return callData;
    } catch (error) {
      logger.error(`Failed to encode calldata: ${error.message}`, { service: 'flashbotExecutorV3' });
      throw error;
    }
  }

  async getNextNonce() {
    try {
      // Use 'pending' to include unconfirmed transactions
      const pendingNonce = await this.provider.getTransactionCount(
        this.wallet.address, 
        'pending'
      );

      // Initialize or update local nonce
      if (this.nonceManager.localNonce === null) {
        this.nonceManager.localNonce = pendingNonce;
      } else {
        // Use the higher of local or pending nonce
        this.nonceManager.localNonce = Math.max(this.nonceManager.localNonce, pendingNonce);
      }

      this.nonceManager.lastUpdate = Date.now();
      return this.nonceManager.localNonce;
    } catch (error) {
      logger.error(`Failed to get nonce: ${error.message}`, { service: 'flashbotExecutorV3' });
      throw error;
    }
  }

  incrementNonce() {
    this.nonceManager.localNonce++;
  }

  resetNonce() {
    this.nonceManager.localNonce = null;
    logger.warn('🔄 Nonce reset', { service: 'flashbotExecutorV3' });
  }

  async estimateGas(callData) {
    try {
      const estimatedGas = await this.provider.estimateGas({
        from: this.wallet.address,
        to: this.contractAddress,
        data: callData,
      });

      // Add 20% buffer
      const gasLimit = (estimatedGas * 120n) / 100n;
      
      logger.info(`⛽ Gas estimated: ${estimatedGas}, with buffer: ${gasLimit}`, { 
        service: 'flashbotExecutorV3' 
      });
      
      return gasLimit;
    } catch (error) {
      logger.warn(`Gas estimation failed, using default: ${error.message}`, { 
        service: 'flashbotExecutorV3' 
      });
      // Fallback to safe default
      return 800000n;
    }
  }

  async buildBundle(opportunity, blockNumber) {
    try {
      const callData = this.encodeCallData(opportunity);
      const network = await this.provider.getNetwork();
      const nonce = await this.getNextNonce();
      
      // Get current fee data for EIP-1559
      const feeData = await this.provider.getFeeData();
      
      if (!feeData.maxFeePerGas || !feeData.maxPriorityFeePerGas) {
        throw new Error('Unable to fetch EIP-1559 fee data');
      }

      // Increase maxPriorityFeePerGas for better inclusion chances
      const priorityFee = (feeData.maxPriorityFeePerGas * 120n) / 100n; // 20% higher
      const maxFee = (feeData.maxFeePerGas * 110n) / 100n; // 10% higher

      // Estimate gas dynamically
      const gasLimit = await this.estimateGas(callData);

      const arbitrageTx = {
        to: this.contractAddress,
        data: callData,
        gasLimit: gasLimit,
        chainId: network.chainId,
        nonce: nonce,
        maxFeePerGas: maxFee,
        maxPriorityFeePerGas: priorityFee,
        type: 2  // EIP-1559 transaction
      };

      logger.info('📦 Building transaction', {
        nonce,
        gasLimit: gasLimit.toString(),
        maxFeePerGas: ethers.formatUnits(maxFee, 'gwei') + ' gwei',
        maxPriorityFeePerGas: ethers.formatUnits(priorityFee, 'gwei') + ' gwei',
        service: 'flashbotExecutorV3'
      });

      const signedArbitrage = await this.wallet.signTransaction(arbitrageTx);

      // Bundle contains only our arbitrage transaction
      // No victim transaction needed for pure arbitrage
      const bundle = [signedArbitrage];

      logger.info('✅ Bundle built successfully', { 
        bundleLength: bundle.length, 
        targetBlock: blockNumber,
        service: 'flashbotExecutorV3' 
      });

      return { bundle, blockNumber, nonce };
    } catch (error) {
      logger.error(`Failed to build bundle: ${error.message}`, { service: 'flashbotExecutorV3' });
      throw error;
    }
  }

  async simulateBundle(bundle, blockNumber) {
    try {
      logger.info('🧪 Simulating bundle...', { 
        blockNumber, 
        service: 'flashbotExecutorV3' 
      });

      const simulation = await this.flashbotsProvider.simulate(bundle, blockNumber);
      
      if ('error' in simulation) {
        throw new Error(`Simulation failed: ${simulation.error.message}`);
      }

      // Check if simulation is profitable
      const gasUsed = simulation.totalGasUsed;
      const gasPrice = simulation.bundleGasPrice;
      const gasCost = gasUsed * gasPrice;

      logger.info('✅ Bundle simulation successful', {
        bundleGasPrice: ethers.formatUnits(gasPrice, 'gwei') + ' gwei',
        totalGasUsed: gasUsed.toString(),
        gasCostEth: ethers.formatEther(gasCost),
        service: 'flashbotExecutorV3'
      });

      return simulation;
    } catch (error) {
      logger.error(`❌ Simulation error: ${error.message}`, { service: 'flashbotExecutorV3' });
      throw error;
    }
  }

  async sendBundle(bundle, blockNumber) {
    try {
      logger.info('📤 Sending bundle to Flashbots...', { 
        blockNumber, 
        service: 'flashbotExecutorV3' 
      });

      // Wrap raw signed transactions for sendBundle
      const wrappedBundle = bundle.map(tx => ({ signedTransaction: tx }));
      
      const bundleResponse = await this.flashbotsProvider.sendBundle(
        wrappedBundle, 
        blockNumber
      );

      if ('error' in bundleResponse) {
        throw new Error(`Bundle submission failed: ${bundleResponse.error.message}`);
      }

      logger.info('✅ Bundle sent successfully', { 
        bundleHash: bundleResponse.bundleHash,
        targetBlock: blockNumber,
        service: 'flashbotExecutorV3' 
      });

      return bundleResponse;
    } catch (error) {
      logger.error(`❌ Send bundle error: ${error.message}`, { service: 'flashbotExecutorV3' });
      throw error;
    }
  }

  async waitForInclusion(bundleResponse, targetBlock) {
    try {
      logger.info('⏳ Waiting for bundle inclusion...', { 
        targetBlock, 
        service: 'flashbotExecutorV3' 
      });

      const resolution = await bundleResponse.wait();
      
      const resolutionMap = {
        [FlashbotsBundleResolution.BundleIncluded]: {
          success: true,
          message: '✅ Bundle included in block!',
          level: 'info'
        },
        [FlashbotsBundleResolution.BlockPassedWithoutInclusion]: {
          success: false,
          message: '⚠️ Block passed without inclusion',
          level: 'warn'
        },
        [FlashbotsBundleResolution.AccountNonceTooHigh]: {
          success: false,
          message: '❌ Account nonce too high',
          level: 'error'
        }
      };

      const result = resolutionMap[resolution] || {
        success: false,
        message: `❓ Unknown resolution: ${resolution}`,
        level: 'warn'
      };

      logger[result.level](result.message, { 
        resolution, 
        targetBlock,
        service: 'flashbotExecutorV3' 
      });

      return {
        resolution,
        success: result.success,
        message: result.message
      };
    } catch (error) {
      logger.error(`Wait error: ${error.message}`, { service: 'flashbotExecutorV3' });
      throw error;
    }
  }

  async executeArbitrage(execOpp, maxRetries = 3) {
    if (!this.initialized) {
      throw new Error('FlashbotExecutorV3 not initialized');
    }

    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`🚀 Execution attempt ${attempt}/${maxRetries}`, { 
          opportunityId: execOpp.id,
          service: 'flashbotExecutorV3' 
        });

        // Get current block
        const block = await this.provider.getBlock('latest');
        const targetBlock = block.number + 1;

        // Build bundle
        const { bundle, nonce } = await this.buildBundle(execOpp, targetBlock);

        // Simulate bundle
        const simulation = await this.simulateBundle(bundle, targetBlock);

        // Check if profitable after gas costs
        const gasCost = simulation.totalGasUsed * simulation.bundleGasPrice;
        const gasCostEth = Number(ethers.formatEther(gasCost));
        const estimatedProfit = Number(execOpp.estimated_profit || 0);

        if (gasCostEth >= estimatedProfit) {
          logger.warn('⚠️ Not profitable after gas costs', {
            gasCostEth,
            estimatedProfit,
            service: 'flashbotExecutorV3'
          });
          return { 
            success: false, 
            error: 'Not profitable after gas costs',
            gasCostEth,
            estimatedProfit
          };
        }

        // Send bundle
        const bundleResponse = await this.sendBundle(bundle, targetBlock);

        // Wait for inclusion
        const inclusionResult = await this.waitForInclusion(bundleResponse, targetBlock);

        if (inclusionResult.success) {
          this.incrementNonce(); // Only increment on success
          
          return {
            success: true,
            bundleHash: bundleResponse.bundleHash,
            blockNumber: targetBlock,
            resolution: inclusionResult.message,
            gasCostEth,
            netProfit: estimatedProfit - gasCostEth
          };
        }

        // If not included, retry with next block
        lastError = new Error(inclusionResult.message);
        logger.warn(`Attempt ${attempt} failed: ${inclusionResult.message}`, { 
          service: 'flashbotExecutorV3' 
        });

        // Reset nonce if account nonce too high
        if (inclusionResult.resolution === FlashbotsBundleResolution.AccountNonceTooHigh) {
          this.resetNonce();
        }

        // Wait before retry
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

      } catch (error) {
        lastError = error;
        logger.error(`Attempt ${attempt} error: ${error.message}`, { 
          service: 'flashbotExecutorV3' 
        });

        // Reset nonce on certain errors
        if (error.message.includes('nonce') || error.message.includes('replacement')) {
          this.resetNonce();
        }

        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }

    // All attempts failed
    return {
      success: false,
      error: lastError?.message || 'All execution attempts failed',
      attempts: maxRetries
    };
  }
}

export default FlashbotExecutor;