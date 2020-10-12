// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.7.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./TokenSpender.sol";


contract KERC20 is ERC20, AccessControl
{
    IERC20 public immutable underlyingToken;
    bytes32 public constant KYC_ADMIN_ROLE = keccak256("KYC_ADMIN_ROLE");
    bytes32 public constant KYC_MEMBER_ROLE = keccak256("KYC_MEMBER_ROLE");

    modifier onlyRole(bytes32 role, address member, string memory message)
    {
        require(hasRole(role, member), message);
        _;
    }

    constructor(address token, string memory name, string memory symbol, address[] memory kycAdmins)
    ERC20(name, symbol)
    {
        // configure token
        underlyingToken = IERC20(token);
        _setupDecimals(ERC20(token).decimals());
        // configure roles
        _setRoleAdmin(KYC_MEMBER_ROLE, KYC_ADMIN_ROLE);
        // grant roles
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        for (uint256 i = 0; i < kycAdmins.length; ++i)
        {
            _setupRole(KYC_ADMIN_ROLE, kycAdmins[i]);
        }
    }

    /*************************************************************************
     *                              Public view                              *
     *************************************************************************/
    function isKYC(address account) public view returns (bool)
    {
        return hasRole(KYC_MEMBER_ROLE, account);
    }

    /*************************************************************************
     *                       Escrow - public interface                       *
     *************************************************************************/
    function deposit(uint256 amount)
    external
    onlyRole(KYC_MEMBER_ROLE, _msgSender(), "account-missing-kyc")
    {
        _deposit(_msgSender(), amount);
        _mint(_msgSender(), amount);
    }

    function withdraw(uint256 amount)
    external
    {
        _burn(_msgSender(), amount);
        _withdraw(_msgSender(), amount);
    }

    function recover()
    external
    onlyRole(DEFAULT_ADMIN_ROLE, _msgSender(), "only-admin")
    {
        _mint(_msgSender(), SafeMath.sub(underlyingToken.balanceOf(address(this)),totalSupply()));
    }

    function receiveApproval(address sender, uint256 amount, address token, bytes calldata)
    external
    onlyRole(KYC_MEMBER_ROLE, sender, "sender-missing-kyc")
    returns (bool)
    {
        require(token == address(underlyingToken), "wrong-token");
        _deposit(sender, amount);
        _mint(sender, amount);
        return true;
    }

    function approveAndCall(address spender, uint256 amount, bytes calldata extraData)
    external returns (bool)
    {
        approve(spender, amount);
        require(TokenSpender(spender).receiveApproval(_msgSender(), amount, address(this), extraData), "approval-refused");
        return true;
    }

    /*************************************************************************
     *                      Escrow - internal functions                      *
     *************************************************************************/
    function _deposit(address from, uint256 amount)
    internal
    {
        require(underlyingToken.transferFrom(from, address(this), amount), "failled-transferFrom");
    }

    function _withdraw(address to, uint256 amount)
    internal
    {
        require(underlyingToken.transfer(to, amount), "failled-transfer");
    }

    /*************************************************************************
     *                 ERC20 - alter behaviour to enable KYC                 *
     *************************************************************************/
    // Only allow transfer between KYC members
    function _transfer(address sender, address recipient, uint256 amount)
    internal override
    onlyRole(KYC_MEMBER_ROLE, sender, "sender-missing-kyc")
    onlyRole(KYC_MEMBER_ROLE, recipient, "receiver-missing-kyc")
    {
        super._transfer(sender, recipient, amount);
    }
}
