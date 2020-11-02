// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.7.0;


interface IERC677
{
    function receiveApproval(address,uint256,address,bytes calldata) external returns (bool);
    function onTokenTransfer(address,uint256,bytes calldata) external returns (bool);
}
