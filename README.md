# RWA Launchpad (MVP)

> **基于 Uniswap Continuous Clearing Auction (CCA) 的合规 RWA 资产发行平台**

本项目旨在构建一个连接 Web2 股权（如 SpaceX、OpenAI 等独角兽企业）与 Web3 流动性的发行平台。通过引入 **连续清算拍卖 (CCA)** 机制，我们致力于实现比传统荷兰拍更公平、更抗抢跑的价格发现过程，并集成 **KYC Hooks** 以满足合规要求。

## 🚀 项目状态 (Project Status)

当前处于 **Phase 1 (Infrastructure & Logic)** 完成阶段。

- [x] **Monorepo 架构搭建**: 完成合约与前端的统一仓库配置。
- [x] **依赖管理**: 解决了 v4-core, solmate, solady 等复杂依赖的路径映射 (Vendorized Dependencies)。
- [x] **核心资产模拟**: 部署了 MockUSDC (支付货币) 和 MockRWA (标的资产)。
- [x] **合规逻辑 (KYC Hook)**: 基于 Solmate Owned 模型实现了权限控制钩子，只有白名单用户可参与竞价。
- [x] **拍卖工厂**: 成功部署 ContinuousClearingAuctionFactory。
- [ ] **Phase 2**: 开启拍卖、脚本交互与前端数据读取 (Coming Next)。

## 📂 项目结构 (Structure)

```text
rwa-launchpad/
├── contracts/               # 智能合约层 (Foundry)
│   ├── src/
│   │   ├── mock/            # 模拟资产 (USDC, RWA)
│   │   ├── KYCValidationHook.sol # 合规钩子合约
│   │   └── ...              # Uniswap CCA 核心逻辑
│   ├── script/              # 部署与交互脚本
│   ├── lib/                 # 本地化依赖库 (No Git Submodules)
│   └── foundry.toml         # 经过深度优化的编译器配置
├── frontend/                # 前端应用层 (Next.js - 待初始化)
└── README.md
```

## 🛠️ 快速开始 (Quick Start)

### 前置要求
* [Foundry](https://getfoundry.sh/) (Forge, Anvil, Cast)
* Git

### 1. 克隆仓库
```bash
git clone https://github.com/CZA1006/rwa-launchpad.git
cd rwa-launchpad
```

### 2. 编译合约
我们已经配置好了 foundry.toml 以忽略第三方库中的测试文件，编译速度极快。

```bash
cd contracts
forge build
```

### 3. 本地部署测试 (Local Deployment)
启动本地 Anvil 链并运行部署脚本：

**终端 1 (启动节点):**
```bash
anvil
```

**终端 2 (执行部署):**
```bash
cd contracts
forge script script/DeployPhase1.s.sol --fork-url http://127.0.0.1:8545 --broadcast
```

如果成功，您将看到如下输出：
```text
== Logs ==
  MockUSDC deployed at: 0x...
  MockRWA deployed at: 0x...
  KYCValidationHook deployed at: 0x...
  AuctionFactory deployed at: 0x...
```

## 🧩 核心技术栈 (Tech Stack)

* **Framework:** [Foundry](https://github.com/foundry-rs/foundry)
* **Auction Mechanism:** [Uniswap CCA](https://github.com/Uniswap/continuous-clearing-auction)
* **Compliance:** Uniswap V4 Hooks (Custom KYC Logic)
* **Math Library:** Solady (FixedPointMathLib) & Uniswap V4 Core (FixedPoint96)
* **Token Standard:** Solmate (ERC20)

## 🗺️ 开发路线图 (Roadmap)

| 阶段 | 时间周期 | 核心目标 |
| :--- | :--- | :--- |
| **Phase 1** | 12/03 - 12/08 | ✅ **链上逻辑验证**：合约部署、Hook 编写、依赖修复。 |
| **Phase 2** | 12/09 - 12/15 | 🔄 **功能闭环**：脚本开启拍卖、模拟出价、前端读取状态。 |
| **Phase 3** | 12/16 - 12/22 | 🎨 **可视化**：绘制价格/募资曲线，UI 美化。 |
| **Phase 4** | 12/23 - 12/29 | 🚀 **发布**：部署测试网 (Arbitrum Sepolia)，Demo 演示。 |

## 📄 License

此项目包含 Uniswap Labs 的代码，受其特定的许可证保护。自定义代码部分 (Mock/Hooks) 为 MIT License。
