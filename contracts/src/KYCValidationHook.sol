// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// 【修改点1】 引入 Owned 而不是 Ownable
import {Owned} from "solmate/auth/Owned.sol";

interface IAuctionHook {
    function validateBid(address bidder, uint256 amount, uint256 limitPrice) external view returns (bytes4);
}

// 【修改点2】 继承 Owned
contract KYCValidationHook is Owned, IAuctionHook {
    mapping(address => bool) public isKyced;
    bytes4 internal constant VALIDATION_SUCCESS = IAuctionHook.validateBid.selector;
    error NotKyced();

    // 【修改点3】 构造函数调用 Owned
    constructor() Owned(msg.sender) {}

    function setKYC(address user, bool status) external onlyOwner {
        isKyced[user] = status;
    }

    function batchSetKYC(address[] calldata users, bool status) external onlyOwner {
        for (uint256 i = 0; i < users.length; i++) {
            isKyced[users[i]] = status;
        }
    }

    function validateBid(address bidder, uint256, uint256) external view override returns (bytes4) {
        if (!isKyced[bidder]) revert NotKyced();
        return VALIDATION_SUCCESS;
    }
}