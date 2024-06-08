/* global BigInt */
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");
require('solidity-coverage');

describe("H2O test", function () {
    async function deployFixture() {
        const H2OToken = await ethers.getContractFactory("H2OToken");

        const [owner, admin, holder, addr1, addr2] = await ethers.getSigners();

        // The admin accounts of the tokens
        const admins = [admin.address]

        // Deploy H2OToken
        const h2o = await upgrades.deployProxy(
            H2OToken,
            [admins, holder.address],
            { kind: 'uups' });

        const minterBurnerRole = await h2o.MINTER_BURNER_ROLE();
        await h2o.connect(admin).grantRole(minterBurnerRole, admin.address);

        return { h2o, owner, admin, holder, addr1, addr2 };
    }

    /***************************
     
      MINT/BURN
     
    ****************************/

    it("Should mint h2o", async function () {
        const { h2o, admin, addr1 } = await loadFixture(deployFixture);
        const mintValue = 100n;

        await h2o.connect(admin).mint(addr1.address, mintValue);

        expect(await h2o.balanceOf(addr1.address)).to.equal(mintValue);
    });

    it("Should burn h2o", async function () {
        const { h2o, admin, holder } = await loadFixture(deployFixture);
        const burnValue = 100n;

        const holderBalance = BigInt(await h2o.balanceOf(holder.address));
        await h2o.connect(admin).burn(holder.address, burnValue);

        expect(await h2o.balanceOf(holder.address)).to.equal(holderBalance - burnValue);
    });

    it("Should not mint or burn when paused", async function () {
        const { h2o, admin, holder } = await loadFixture(deployFixture);
        const mintBurnValue = 100n;

        await h2o.connect(admin).pause();

        await expect(h2o.connect(admin).mint(holder.address, mintBurnValue)).to.be.revertedWith("Pausable: paused");
        await expect(h2o.connect(admin).burn(holder.address, mintBurnValue)).to.be.revertedWith("Pausable: paused");
    });

    it("Should not let unauthorized address mint or burn", async function () {
        const { h2o, holder, addr1 } = await loadFixture(deployFixture);
        const mintBurnValue = 100n;

        await expect(h2o.connect(addr1).mint(holder.address, mintBurnValue)).to.be.reverted;
        await expect(h2o.connect(addr1).burn(holder.address, mintBurnValue)).to.be.reverted;
    });

    /***************************
 
      TRANSFER
 
    ****************************/

    it("Should transfer", async function () {
        const { h2o, holder, addr1 } = await loadFixture(deployFixture);
        const transferValue = 100n;

        await h2o.connect(holder).transfer(addr1.address, transferValue);

        expect(await h2o.balanceOf(addr1.address)).to.equal(transferValue);
    });

    it("Should not transfer when paused", async function () {
        const { h2o, admin, holder, addr1 } = await loadFixture(deployFixture);
        const transferValue = 100n;

        await h2o.connect(admin).pause();

        await expect(h2o.connect(holder).transfer(addr1.address, transferValue)).to.be.revertedWith("Pausable: paused");
    });

    /***************************
 
      PAUSE
 
    ****************************/

    it("Should not let non-admin pause or unpause", async function () {
        const { h2o, admin, addr1 } = await loadFixture(deployFixture);

        await expect(h2o.connect(addr1).pause()).to.be.reverted;
        await h2o.connect(admin).pause();
        await expect(h2o.connect(addr1).unpause()).to.be.reverted;
    });

    /***************************
 
      DECIMALS
 
    ****************************/

    it("Should get decimals", async function () {
        const { h2o, addr1 } = await loadFixture(deployFixture);
        const decimals = 18;

        expect(await h2o.connect(addr1).decimals()).to.equal(decimals);
    });
});

