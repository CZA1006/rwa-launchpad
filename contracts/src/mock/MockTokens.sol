// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// 修正导入路径：从 "solmate/src/tokens/..." 改为 "solmate/tokens/..."
import {ERC20} from "solmate/tokens/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "mUSDC", 6) {
        _mint(msg.sender, 1_000_000_000 * 1e6);
    }
    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
}

contract MockRWA is ERC20 {
    constructor() ERC20("SpaceX Equity Token", "SPX", 18) {
        _mint(msg.sender, 10_000_000 * 1e18);
    }
}