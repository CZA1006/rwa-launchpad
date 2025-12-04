# RWA Launchpad (MVP)

> **连接 Web2 股权与 Web3 流动性的合规资产发行平台**

本项目旨在构建一个去中心化的 RWA (Real World Asset) 发行平台，允许企业（如 SpaceX、OpenAI 等独角兽）将股权代币化并通过链上拍卖进行分发。

项目核心采用 **“连续多轮荷式拍卖” (Continuous Multi-Round Dutch Auction)** 机制，结合 **KYC 权限钩子**，实现了兼具公平性、抗抢跑和合规性的资产发行方案。

---

## 🚀 项目状态 (Project Status)

当前处于 **Phase 2 (功能闭环)** 完成阶段。

- [x] **核心架构**: 完成单体仓库 (Monorepo) 搭建与依赖管理 (Vendorized Dependencies)。
- [x] **基础设施**: 部署了 MockUSDC (支付)、MockRWA (资产) 及 KYCValidationHook (合规)。
- [x] **竞价机制 (Dutch Auction)**: 
  - 实现每 30 分钟一轮的连续竞拍。
  - 价格随时间线性衰减 (Linear Decay)。
  - 支持原子化即时成交 (Instant Settlement)。
- [x] **自动化测试**: 编写了完整的 Foundry 脚本，模拟“部署 -> 开启拍卖 -> 时间旅行 -> 模拟购买”的全流程。

---

## 🧪 开发与测试指南 (Quick Start)

本项目使用 **Foundry** 进行开发和测试。请按照以下步骤在本地通过脚本验证业务逻辑。

### 1. 环境准备
确保已安装 [Foundry](https://getfoundry.sh/) 和 Git。
```bash
git clone https://github.com/CZA1006/rwa-launchpad.git
cd rwa-launchpad
cd contracts
forge build
```

### 2. 启动本地链
打开一个**新的终端窗口**，启动 Anvil 本地节点：
```bash
anvil
```
*(注意：保持此窗口运行，后续脚本将与此节点交互)*

### 3. 执行端到端测试 (End-to-End Testing)

我们需要按顺序运行脚本来模拟真实的发行流程。

#### 🟢 第一步：部署基础设施 (Infrastructure)
部署代币合约、KYC 钩子和工厂合约。
```bash
forge script script/DeployPhase1.s.sol --fork-url http://127.0.0.1:8545 --broadcast
```
> **⚠️ 重要：** 脚本运行成功后，请从终端日志中**复制** MockUSDC, MockRWA, KYC_HOOK 的合约地址。

#### 🟢 第二步：开启荷式拍卖 (Create Auction)
1. 打开 script/CreateDutchAuction.s.sol。
2. 将顶部常量的地址替换为您刚才复制的新地址。
3. 运行脚本：
```bash
forge script script/CreateDutchAuction.s.sol --fork-url http://127.0.0.1:8545 --broadcast
```
> **预期结果：** 终端显示 >>> NEW DUTCH AUCTION CREATED AT: 0x...。请**复制**这个新的拍卖合约地址。

#### 🟢 第三步：模拟用户购买 (Simulate Buy)
此脚本将模拟：给用户发钱 -> 通过 KYC -> **时间快进 15 分钟** (价格下跌) -> 用户成功买入。

1. 打开 script/BuyDutch.s.sol。
2. 更新 MOCK_USDC, KYC_HOOK 地址。
3. 更新 AUCTION_ADDRESS 为第二步生成的地址。
4. 运行脚本：
```bash
forge script script/BuyDutch.s.sol --fork-url http://127.0.0.1:8545 --broadcast
```
> **预期结果：** 您将看到 Time Travel: Warping 15 minutes 和 BUY SUCCESSFUL! Bought 10 RWA 的成功日志。

---

## 📂 项目结构 (Structure)

```text
rwa-launchpad/
├── contracts/                  # 智能合约核心 (Foundry)
│   ├── src/
│   │   ├── DutchAuction.sol    # [核心] 荷式拍卖逻辑 (定价、轮次、购买)
│   │   ├── DutchAuctionFactory.sol # [核心] 拍卖工厂 (批量创建、注资)
│   │   ├── KYCValidationHook.sol   # [合规] 白名单权限控制
│   │   ├── mock/               # 模拟资产 (ERC20)
│   │   └── ...                 # (旧) CCA 拍卖代码保留作为参考
│   ├── script/                 # 自动化部署与交互脚本
│   │   ├── DeployPhase1.s.sol        # 基础部署
│   │   ├── CreateDutchAuction.s.sol  # 开启拍卖
│   │   └── BuyDutch.s.sol            # 购买测试
│   └── foundry.toml            # 编译器配置
├── frontend/                   # 前端应用 (Next.js + Wagmi - 待开发)
└── README.md
```

## 🧩 核心机制说明

### 连续多轮荷式拍卖 (Dutch Auction)
* **轮次设计**：拍卖总时长被划分为多个固定时长的轮次（如每轮 30 分钟）。
* **定价逻辑**：每轮开始时价格重置为 StartPrice，随时间线性下跌至 FloorPrice。
* **结算方式**：**Pay-as-Bid**。用户接受当前价格并调用 buy()，智能合约立即扣除 USDC 并发送 RWA 代币。

### 合规层 (Compliance)
* 集成 **Hooks** 机制。在用户调用 buy() 时，合约会回调 KYCValidationHook。
* 只有在 Hook 中被标记为 isKyced 的地址才能完成交易，否则直接 Revert。

---

## 🗺️ 开发路线图 (Roadmap)

| 阶段 | 状态 | 核心目标 |
| :--- | :--- | :--- |
| **Phase 1** | ✅ 完成 | 基础设施搭建、依赖管理、Mock 资产上链。 |
| **Phase 2** | ✅ 完成 | **智能合约闭环**。实现荷式拍卖核心逻辑、编写 E2E 测试脚本验证流程。 |
| **Phase 3** | 🔄 待开始 | **前端集成**。搭建 Next.js 界面，连接钱包，可视化展示价格曲线与倒计时。 |
| **Phase 4** | ⏳ 规划中 | **测试网发布**。部署至 Arbitrum Sepolia，进行公开演示。 |

## 📄 License
MIT
