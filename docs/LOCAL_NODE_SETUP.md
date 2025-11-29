# Local Ethereum Node Setup for MEV Bot

## Hardware Requirements (Recommended)

- **CPU**: 8+ cores (Intel i7/i9 or AMD Ryzen 7/9)
- **RAM**: 32GB minimum (64GB recommended)
- **Storage**: 2TB NVMe SSD (fast I/O critical!)
- **Network**: 100+ Mbps, low latency connection
- **OS**: Ubuntu 22.04 LTS (or Windows with WSL2)

## Option 1: Geth (Most Popular)

### Installation

```bash
# Ubuntu/WSL2
sudo add-apt-repository -y ppa:ethereum/ethereum
sudo apt-get update
sudo apt-get install -y geth

# Windows: Download from https://geth.ethereum.org/downloads/
```

### Optimized Configuration

Create `geth-start.sh`:

```bash
#!/bin/bash

# Ethereum Mainnet with MEV-optimized settings
geth \
  --syncmode snap \
  --http \
  --http.addr 127.0.0.1 \
  --http.port 8545 \
  --http.api eth,net,web3,txpool \
  --http.corsdomain "*" \
  --ws \
  --ws.addr 127.0.0.1 \
  --ws.port 8546 \
  --ws.api eth,net,web3,txpool \
  --ws.origins "*" \
  --maxpeers 100 \
  --cache 8192 \
  --txpool.globalslots 20000 \
  --txpool.globalqueue 10000 \
  --txpool.accountslots 64 \
  --txpool.accountqueue 64 \
  --txlookuplimit 0 \
  --datadir ./ethereum-data \
  --metrics \
  --metrics.addr 127.0.0.1 \
  --metrics.port 6060
```

**Key Parameters Explained:**
- `--syncmode snap`: Fast sync (2-6 hours vs 2-3 days for full)
- `--cache 8192`: 8GB cache (adjust based on your RAM)
- `--maxpeers 100`: More peers = faster sync & better propagation
- `--txpool.globalslots 20000`: Large mempool for opportunity detection
- `--http.api txpool`: Access to pending transactions (critical for MEV)
- `--metrics`: Monitor node performance

### Start Sync

```bash
chmod +x geth-start.sh
./geth-start.sh
```

**Initial Sync Time:** 2-6 hours (snap mode)

---

## Option 2: Erigon (Faster & Less Storage)

### Installation

```bash
# Ubuntu/WSL2
git clone https://github.com/ledgerwatch/erigon.git
cd erigon
make erigon
```


### Optimized Configuration

Create `erigon-start.sh`:

```bash
#!/bin/bash

./build/bin/erigon \
  --datadir ./erigon-data \
  --chain mainnet \
  --http.addr 127.0.0.1 \
  --http.port 8545 \
  --http.api eth,net,web3,txpool,trace \
  --ws \
  --private.api.addr=127.0.0.1:9090 \
  --http.corsdomain "*" \
  --metrics \
  --prune htc \
  --maxpeers 100
```

**Advantages:**
- ✅ 50% less storage than Geth (~800GB vs 1.5TB)
- ✅ Faster sync (~4-8 hours)
- ✅ Better archive queries
- ✅ Lower resource usage

---

## Verify Node is Working

```bash
# Check sync status
curl -X POST http://127.0.0.1:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_syncing","params":[],"id":1}'

# Response: false = fully synced
# Response: {...} = still syncing

# Check block number
curl -X POST http://127.0.0.1:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Test WebSocket
wscat -c ws://127.0.0.1:8546

# Subscribe to new blocks
{"jsonrpc":"2.0","method":"eth_subscribe","params":["newHeads"],"id":1}
```

---

## Performance Monitoring

```bash
# Monitor Geth metrics
curl http://127.0.0.1:6060/debug/metrics/prometheus

# Key metrics to watch:
# - chain/head/block: Current block height
# - p2p/peers: Number of connected peers
# - txpool/pending: Pending transactions in mempool
# - system/memory/held: Memory usage
```

---

## Configuration for Bot

Update `.env`:

```bash
# Local node (ultra-low latency!)
RPC_URL=http://127.0.0.1:8545
WS_URL=ws://127.0.0.1:8546

# Backup remote nodes (fallback)
ALCHEMY_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
QUICKNODE_URL=https://YOUR-ENDPOINT.quiknode.pro/YOUR_KEY
```

---

## Maintenance

### Daily Checks
```bash
# Check disk space (should have 200GB+ free)
df -h

# Check node is synced
geth attach http://127.0.0.1:8545 --exec "eth.syncing"

# Check peer count (should be 50+)
geth attach http://127.0.0.1:8545 --exec "net.peerCount"
```

### Weekly Tasks
- Monitor logs for errors
- Check storage usage growth
- Verify mempool size is healthy

---

## Expected Performance Gains

| Metric | Remote RPC | Local Node | Improvement |
|--------|-----------|------------|-------------|
| **RPC Latency** | 50-200ms | 0.5-2ms | **100x faster** |
| **Block Events** | +200ms delay | Real-time | **200ms advantage** |
| **Mempool Access** | Limited | Full access | **See pending txs** |
| **Rate Limits** | Yes (100-300/s) | None | **Unlimited** |
| **Cost** | $200-500/mo | Electricity | **Saves $2400-6000/yr** |
| **Success Rate** | 60-70% | 90-95% | **+30%** |

---

## Troubleshooting

### Sync is Stuck
```bash
# Check peers
geth attach --exec "admin.peers.length"

# Add manual peers
geth attach --exec 'admin.addPeer("enode://...")'
```

### High Memory Usage
```bash
# Reduce cache size
geth ... --cache 4096  # Use 4GB instead of 8GB
```

### Disk Space Running Low
```bash
# Geth: Prune old data (can reclaim ~200GB)
geth snapshot prune-state --datadir ./ethereum-data

# Erigon: Already pruned by default
```

---

## Security Notes

- ✅ Node should ONLY listen on 127.0.0.1 (localhost)
- ✅ DO NOT expose ports 8545/8546 to internet
- ✅ Use firewall to block external access
- ✅ Keep geth/erigon updated monthly

---

## Next Steps

Once your node is fully synced:
1. ✅ Update bot configuration to use local node
2. ✅ Test RPC latency: `src/utils/testLatency.js`
3. ✅ Enable parallel processing features
4. ✅ Monitor performance improvements
5. ✅ Start bot and watch success rate increase!
