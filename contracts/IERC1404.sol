// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.7.0;


interface IERC1404
{
    function detectTransferRestriction(address from, address to, uint256 value) external view returns (uint8);
    function messageForTransferRestriction(uint8 restrictionCode) external view returns (string memory);
}
