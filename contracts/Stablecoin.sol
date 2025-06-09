// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Stablecoin is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {
        // _mint(msg.sender, 100_000_000 * 10 ** 18);
    }

    function mint(address beneficiary, uint256 amount) public {
        // Here there could be an admin check
        _mint(beneficiary, amount);
    }

    function burn(address beneficiary, uint256 amount) public {
        _burn(beneficiary, amount);
    }

    function decimals() public view virtual override returns (uint8) {
        return 6;
    }
}
