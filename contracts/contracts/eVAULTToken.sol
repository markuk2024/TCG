// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title eVAULTToken
 * @dev Ecosystem reward token for TCG Vault Protocol
 * Non-transferable outside approved ecosystem contracts
 */
contract eVAULTToken is ERC20, Ownable, Pausable {

    // Maximum token supply (1 billion)
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 1e18;

    // Authorized contracts that can mint/burn eVAULT
    mapping(address => bool) public authorizedMinters;

    // Contracts that can receive eVAULT
    mapping(address => bool) public authorizedSpenders;

    event MinterAuthorized(address indexed minter);
    event MinterRevoked(address indexed minter);
    event SpenderAuthorized(address indexed spender);
    event SpenderRevoked(address indexed spender);

    modifier onlyAuthorizedMinter() {
        require(authorizedMinters[msg.sender], "Not authorized minter");
        _;
    }

    constructor() ERC20("eVAULT", "eVAULT") {}

    /**
     * @dev Restrict transfers outside ecosystem
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override whenNotPaused {

        super._beforeTokenTransfer(from, to, amount);

        // Allow mint
        if (from == address(0)) return;

        // Allow burn
        if (to == address(0)) return;

        // Allow transfers only to approved ecosystem contracts
        require(
            authorizedSpenders[to] || authorizedMinters[to],
            "eVAULT: transfers restricted to ecosystem"
        );
    }

    /**
     * @dev Mint rewards
     */
    function mint(address to, uint256 amount)
        external
        onlyAuthorizedMinter
    {
        require(totalSupply() + amount <= MAX_SUPPLY, "Max supply exceeded");
        _mint(to, amount);
    }

    /**
     * @dev Burn tokens when spent
     */
    function burn(address from, uint256 amount)
        external
        onlyAuthorizedMinter
    {
        _burn(from, amount);
    }

    /**
     * @dev Optional burnFrom (marketplace spending)
     */
    function burnFrom(address account, uint256 amount)
        external
        onlyAuthorizedMinter
    {
        _burn(account, amount);
    }

    /**
     * @dev Authorize contract to mint/burn
     */
    function authorizeMinter(address minter)
        external
        onlyOwner
    {
        require(minter != address(0), "Invalid address");
        authorizedMinters[minter] = true;
        emit MinterAuthorized(minter);
    }

    function revokeMinter(address minter)
        external
        onlyOwner
    {
        authorizedMinters[minter] = false;
        emit MinterRevoked(minter);
    }

    /**
     * @dev Authorize ecosystem contract to receive eVAULT
     */
    function authorizeSpender(address spender)
        external
        onlyOwner
    {
        require(spender != address(0), "Invalid address");
        authorizedSpenders[spender] = true;
        emit SpenderAuthorized(spender);
    }

    function revokeSpender(address spender)
        external
        onlyOwner
    {
        authorizedSpenders[spender] = false;
        emit SpenderRevoked(spender);
    }

    /**
     * @dev Emergency pause
     */
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Check if address can receive eVAULT
     */
    function canReceiveEVAULT(address account)
        external
        view
        returns (bool)
    {
        return authorizedSpenders[account] || authorizedMinters[account];
    }
}
