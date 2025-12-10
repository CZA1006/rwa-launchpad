// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "solmate/tokens/ERC20.sol";

/// @notice GO Token 作为稳定币（充当 USDC）
contract GOToken is ERC20 {
    constructor() ERC20("GO Token", "GO", 18) {
        _mint(msg.sender, 1_000_000_000 * 1e18); // 10亿 GO
    }
    
    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
}

/// @notice RWA Token - 代表真实世界资产
contract RWAToken is ERC20 {
    constructor() ERC20("Real World Asset Token", "RWA", 18) {
        _mint(msg.sender, 10_000_000 * 1e18); // 1000万 RWA
    }
    
    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
}
