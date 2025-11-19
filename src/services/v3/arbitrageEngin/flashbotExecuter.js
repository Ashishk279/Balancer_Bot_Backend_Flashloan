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
  }

  async initialize() {
    try {
      const network = await this.provider.getNetwork();
      console.log('Current Network Chain ID:', network.chainId);
      logger.info(`Current Network Chain ID: ${network.chainId}`, { service: 'flashbotExecutorV3' });
      this.flashbotsProvider = await FlashbotsBundleProvider.create(this.provider, this.wallet, this.relayUrl);
      this.initialized = true;
      logger.info('FlashbotExecutorV3 initialized successfully', { service: 'flashbotExecutorV3' });
      console.log('✅ FlashbotExecutorV3 initialized');
    } catch (error) {
      logger.error(`Failed to initialize FlashbotExecutorV3: ${error.message}`, { service: 'flashbotExecutorV3' });
      throw error;
    }
  }

  encodeCallData(opportunity) {
    const { execution_payload: payload, type } = opportunity;
    const deadline = payload.deadline || Math.floor(Date.now() / 1000) + 12; // 12 seconds from now
    let callData;

    // console.log('Opportunity in encodeCallData:', opportunity);

    if (type === 'v3_triangular' || payload.loanAmount) {
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
        payload.deadline,
      ]);
    }

    console.log('Encoded CallData:', callData);
    return callData;
  }

  async getNextNonce() {
    // Fetch fresh nonce from network
    const networkNonce = await this.provider.getTransactionCount(this.wallet.address, 'latest');

    // Use the higher of local or network nonce
    this.localNonce = Math.max(this.localNonce || 0, networkNonce);

    return this.localNonce;
  }

  incrementNonce() {
    this.localNonce++;
  }

  async buildBundle(opportunity, blockNumber) {
    try {
      const { txHash } = opportunity;
      let victimTx = null;

      // Only fetch victim tx if txHash is valid
      if (txHash && txHash.length === 66 && txHash.startsWith('0x')) {
        victimTx = await this.provider.getTransaction(txHash);
        if (!victimTx) {
          logger.warn(`Victim transaction ${txHash} not found for ${opportunity.id}`, { service: 'flashbotExecutorV3' });
        }
      } else {
        logger.warn(`Skipping victim tx fetch for ${opportunity.id}: Invalid txHash (${txHash})`, { service: 'flashbotExecutorV3' });
      }

      const callData = this.encodeCallData(opportunity);

      const network = await this.provider.getNetwork();
      const nonce = await this.getNextNonce();

      const arbitrageTx = {
        to: this.contractAddress,
        data: callData,
        gasLimit: 500000,
        chainId: network.chainId,  
        nonce: nonce,  
        
      };

      const signedArbitrage = await this.wallet.signTransaction(arbitrageTx);

      // Build bundle as an array of raw signed transaction strings
      const bundle = [signedArbitrage]; // Use raw signed transaction string
      if (victimTx && victimTx.raw) {
        bundle.unshift(victimTx.raw); // Use raw signed transaction string
      }

      logger.info('Bundle built successfully', { bundleLength: bundle.length, service: 'flashbotExecutorV3' });
      console.log('Built Bundle:', bundle);
      return { bundle, blockNumber };
    } catch (error) {
      logger.error(`Failed to build bundle: ${error.message}`, { service: 'flashbotExecutorV3' });
      throw error;
    }
  }

  async simulateBundle(bundle, blockNumber) {
    try {
      const simulation = await this.flashbotsProvider.simulate(bundle, blockNumber);
      if ('error' in simulation) {
        throw new Error(`Simulation failed: ${simulation.error.message}`);
      }
      logger.info('Bundle simulation successful', {
        bundleGasPrice: simulation.bundleGasPrice.toString(),
        totalGasUsed: simulation.totalGasUsed,
        service: 'flashbotExecutorV3'
      });
      return simulation;
    } catch (error) {
      logger.error(`Simulation error: ${error.message}`, { service: 'flashbotExecutorV3' });
      throw error;
    }
  }

  async sendBundle(bundle, blockNumber) {
    try {
      // Wrap raw strings in objects with signedTransaction property for sendBundle
      const wrappedBundle = bundle.map(tx => ({ signedTransaction: tx }));
      const bundleResponse = await this.flashbotsProvider.sendBundle(wrappedBundle, blockNumber);
      await new Promise(resolve => setTimeout(resolve, 2000));

      if ('error' in bundleResponse) {
        throw new Error(`Bundle submission failed: ${bundleResponse.error.message}`);
      }
      logger.info('Bundle sent successfully', { bundleHash: bundleResponse.bundleHash, service: 'flashbotExecutorV3' });
      return bundleResponse;
    } catch (error) {
      logger.error(`Send bundle error: ${error.message}`, { service: 'flashbotExecutorV3' });
      throw error;
    }
  }

  async executeArbitrage(execOpp) {
    if (!this.initialized) throw new Error('FlashbotExecutorV3 not initialized');

    try {
      const block = await this.provider.getBlock('latest');
      const blockNumber = block.number + 1;

      const { bundle } = await this.buildBundle(execOpp, blockNumber);
      await this.simulateBundle(bundle, blockNumber);
      const bundleResponse = await this.sendBundle(bundle, blockNumber);
     
      const waitResponse = await bundleResponse.wait()
      console.log(`Wait Response: ${FlashbotsBundleResolution[waitResponse]}`)
     
      await new Promise(resolve => setTimeout(resolve, 2000));
      logger.info(`Bundle wait response: ${bundleResponse} ${bundleResponse.bundleTransactions} ${bundleResponse.wait} ${bundleResponse.simulate} ${bundleResponse.receipts}`, { bundleResponse, service: 'flashbotExecutorV3' });

      // Check if waitResponse is an array and handle accordingly

      logger.info('Bundle executed successfully', {
        bundleHash: bundleResponse.bundleHash,
        blockNumber: bundleResponse.blockNumber,
        service: 'flashbotExecutorV3'
      });
      return { success: true, bundleHash: bundleResponse.bundleHash, blockNumber: bundleResponse.blockNumber };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

export default FlashbotExecutor;