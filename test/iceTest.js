/* global BigInt */
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");
require('solidity-coverage');

describe("Ice test", function () {
    async function deployFixture() {
        const IceToken = await ethers.getContractFactory("IceToken");

        const [owner, admin, holder, addr1, addr2] = await ethers.getSigners();

        // The admin accounts of the tokens
        const admins = [admin.address]

        // Deploy IceToken
        const ice = await upgrades.deployProxy(
            IceToken,
            [admins, holder.address],
            { kind: 'uups' });

        const minterBurnerRole = await ice.MINTER_BURNER_ROLE();
        await ice.connect(admin).grantRole(minterBurnerRole, admin.address);
        const claimerRole = await ice.CLAIMER_ROLE();
        await ice.connect(admin).grantRole(claimerRole, admin.address);

        return { ice, owner, admin, holder, addr1, addr2 };
    }

    /***************************
     
      MINT/BURN
     
    ****************************/

    it("Should mint ice", async function () {
        const { ice, admin, addr1 } = await loadFixture(deployFixture);
        const mintValue = 100n;

        await ice.connect(admin).mint(addr1.address, mintValue);

        expect(await ice.balanceOf(addr1.address)).to.equal(mintValue);
    });

    it("Should burn ice", async function () {
        const { ice, admin, holder } = await loadFixture(deployFixture);
        const burnValue = 100n;

        const holderBalance = BigInt(await ice.balanceOf(holder.address));
        await ice.connect(admin).burn(holder.address, burnValue);

        expect(await ice.balanceOf(holder.address)).to.equal(holderBalance - burnValue);
    });

    it("Should not mint or burn when paused", async function () {
        const { ice, admin, holder } = await loadFixture(deployFixture);
        const mintBurnValue = 100n;

        await ice.connect(admin).pause();

        await expect(ice.connect(admin).mint(holder.address, mintBurnValue)).to.be.revertedWith("Pausable: paused");
        await expect(ice.connect(admin).burn(holder.address, mintBurnValue)).to.be.revertedWith("Pausable: paused");
    });

    it("Should not let unauthorized address mint or burn", async function () {
        const { ice, holder, addr1 } = await loadFixture(deployFixture);
        const mintBurnValue = 100n;

        await expect(ice.connect(addr1).mint(holder.address, mintBurnValue)).to.be.reverted;
        await expect(ice.connect(addr1).burn(holder.address, mintBurnValue)).to.be.reverted;
    });

    /***************************
 
      CLAIM REWARD
 
    ****************************/

    it("Should claim reward", async function () {
        const { ice, admin, holder } = await loadFixture(deployFixture);

        const rewardBalance = await ice.claimableReward(holder.address);
        expect(await rewardBalance).to.be.gt(0n);
        await ice.connect(admin).claimReward(holder.address);

        expect(await ice.claimableReward(holder.address)).to.be.lt(rewardBalance);
    });

    it("Should not claim reward when paused", async function () {
        const { ice, admin, holder } = await loadFixture(deployFixture);

        await ice.connect(admin).pause();

        await expect(ice.connect(admin).claimReward(holder.address)).to.be.revertedWith("Pausable: paused");
    });

    it("Should not let unauthorized address claim reward", async function () {
        const { ice, holder } = await loadFixture(deployFixture);

        await expect(ice.connect(holder).claimReward(holder.address)).to.be.reverted;
    });

    /***************************
 
      TRANSFER
 
    ****************************/

    it("Should transfer", async function () {
        const { ice, holder, addr1 } = await loadFixture(deployFixture);
        const transferValue = 100n;
        const transferTaxTwoDecimal = 2n;
        const twoDecimalBase = 100n;

        await ice.connect(holder).transfer(addr1.address, transferValue);

        expect(await ice.balanceOf(addr1.address)).to.equal(transferValue * (twoDecimalBase - transferTaxTwoDecimal)/twoDecimalBase);
    });

    it("Should not transfer when paused", async function () {
        const { ice, admin, holder, addr1 } = await loadFixture(deployFixture);
        const transferValue = 100n;

        await ice.connect(admin).pause();

        await expect(ice.connect(holder).transfer(addr1.address, transferValue)).to.be.revertedWith("Pausable: paused");
    });

    it("Should not transfer when non-transferable but mint and burn", async function () {
        const { ice, admin, holder, addr1 } = await loadFixture(deployFixture);
        const transferValue = 100n;
        const mintBurnValue = 100n;

        await ice.connect(admin).setTransferable(false);

        await expect(ice.connect(holder).transfer(addr1.address, transferValue)).to.be.revertedWith("IceToken is non transferable.");

        await ice.connect(admin).mint(addr1.address, mintBurnValue);
        expect(await ice.balanceOf(addr1.address)).to.equal(mintBurnValue);
        await ice.connect(admin).burn(addr1.address, mintBurnValue);
        expect(await ice.balanceOf(addr1.address)).to.equal(0n);
    });

    it("Should set transfer tax and apply it", async function () {
        const { ice, admin, holder, addr1 } = await loadFixture(deployFixture);
        const transferValue = 100n;
        const fiftyPercentTax = BigInt(ethers.utils.parseUnits("0.5", "ether"));
        const oneEEighteen = BigInt(ethers.utils.parseUnits("1", "ether"));

        await ice.connect(admin).setTransferTax(fiftyPercentTax);
        await ice.connect(holder).transfer(addr1.address, transferValue);

        expect(await ice.balanceOf(addr1.address)).to.equal(transferValue * fiftyPercentTax / oneEEighteen);
    });

    it("Should not let unauthorized address set tax or transfer", async function () {
        const { ice, holder } = await loadFixture(deployFixture);
        const fiftyPercentTax = BigInt(ethers.utils.parseUnits("0.5", "ether"));

        await expect(ice.connect(holder).setTransferTax(fiftyPercentTax)).to.be.reverted;
        await expect(ice.connect(holder).setTransferable(false)).to.be.reverted;
    });

    /***************************
 
      PAUSE
 
    ****************************/

    it("Should not let non-admin pause or unpause", async function () {
        const { ice, admin, addr1 } = await loadFixture(deployFixture);

        await expect(ice.connect(addr1).pause()).to.be.reverted;
        await ice.connect(admin).pause();
        await expect(ice.connect(addr1).unpause()).to.be.reverted;
    });

    /***************************
 
      DECIMALS
 
    ****************************/

    it("Should get decimals", async function () {
        const { ice, addr1 } = await loadFixture(deployFixture);
        const decimals = 18;

        expect(await ice.connect(addr1).decimals()).to.equal(decimals);
    });
});
