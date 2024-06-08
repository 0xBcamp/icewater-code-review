/* global BigInt */
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");
require('solidity-coverage');

describe("Ice Cube test", function () {
    async function deployFixture() {
        const IceCube = await ethers.getContractFactory("IceCube");

        const [owner, admin, holder, addr1, addr2] = await ethers.getSigners();

        // The admin accounts of the tokens
        const admins = [admin.address]

        // Deploy IceCube
        const iceCube = await upgrades.deployProxy(
            IceCube,
            [admins],
            { kind: 'uups' });

        const minterRedeemerRole = await iceCube.MINTER_REDEEMER_ROLE();
        await iceCube.connect(admin).grantRole(minterRedeemerRole, admin.address);

        return { iceCube, owner, admin, holder, addr1, addr2 };
    }

    /***************************
     
      MINT/REDEEM
     
    ****************************/

    it("Should mint ice cube", async function () {
        const { iceCube, admin, holder, addr1 } = await loadFixture(deployFixture);
        const mintValue = 100n;
        const startTime = BigInt((await ethers.provider.getBlock("latest")).timestamp);
        const duration = 600n;
        const endTime = startTime + duration;
        const id = 1;

        await iceCube.connect(admin).mint(addr1.address, holder.address, mintValue, startTime, endTime);

        expect(await iceCube.isRedeemed(id)).to.equal(false);
        expect(await iceCube.getRedeemer(id)).to.equal(addr1.address);
        expect(await iceCube.getAmount(id)).to.equal(mintValue);
        expect(await iceCube.getStartTime(id)).to.equal(startTime);
        expect(await iceCube.getEndTime(id)).to.equal(endTime);
        expect(await iceCube.getLastRewardTime(id)).to.equal(startTime);
    });

    it("Should redeem ice cube", async function () {
        const { iceCube, admin, holder, addr1 } = await loadFixture(deployFixture);
        const mintValue = 100n;
        const startTime = BigInt((await ethers.provider.getBlock("latest")).timestamp);
        const duration = 600;
        const endTime = startTime + BigInt(duration);
        const id = 1;

        await iceCube.connect(admin).mint(addr1.address, holder.address, mintValue, startTime, endTime);

        await ethers.provider.send('evm_increaseTime', [duration + 1]);
        await ethers.provider.send('evm_mine');

        await iceCube.connect(admin).redeem(id);

        expect(await iceCube.isRedeemed(id)).to.equal(true);
    });

    it("Should not mint or redeem when paused", async function () {
        const { iceCube, admin, holder, addr1 } = await loadFixture(deployFixture);
        const mintValue = 100n;
        const startTime = BigInt((await ethers.provider.getBlock("latest")).timestamp);
        const duration = 600;
        const endTime = startTime + BigInt(duration);
        const id = 1;

        await iceCube.connect(admin).pause();

        await expect(iceCube.connect(admin).mint(addr1.address, holder.address, mintValue, startTime, endTime)).to.be.revertedWith("Pausable: paused");
        await expect(iceCube.connect(admin).redeem(id)).to.be.revertedWith("Pausable: paused");
    });

    it("Should not let unauthorized address mint or redeem", async function () {
        const { iceCube, admin, holder, addr1 } = await loadFixture(deployFixture);
        const mintValue = 100n;
        const startTime = BigInt((await ethers.provider.getBlock("latest")).timestamp);
        const duration = 600;
        const endTime = startTime + BigInt(duration);
        const id = 1;

        await expect(iceCube.connect(holder).mint(addr1.address, holder.address, mintValue, startTime, endTime)).to.be.reverted;

        await iceCube.connect(admin).mint(addr1.address, holder.address, mintValue, startTime, endTime);
        await expect(iceCube.connect(addr1).redeem(id)).to.be.reverted;
    });

    it("Should not redeem non-existent ice cube", async function () {
        const { iceCube, admin } = await loadFixture(deployFixture);
        const id = 1;

        await expect(iceCube.connect(admin).redeem(id)).to.be.revertedWith("Invalid IceCube ID.");
    });

    it("Should not redeem already redeemed ice cube", async function () {
        const { iceCube, admin, holder, addr1 } = await loadFixture(deployFixture);
        const mintValue = 100n;
        const startTime = BigInt((await ethers.provider.getBlock("latest")).timestamp);
        const duration = 600;
        const endTime = startTime + BigInt(duration);
        const id = 1;

        await iceCube.connect(admin).mint(addr1.address, holder.address, mintValue, startTime, endTime);
        await ethers.provider.send('evm_increaseTime', [duration + 1]);
        await ethers.provider.send('evm_mine');
        await iceCube.connect(admin).redeem(id);

        await expect(iceCube.connect(admin).redeem(id)).to.be.revertedWith("IceCube already redeemed.");
    });

    it("Should not redeem active ice cube", async function () {
        const { iceCube, admin, holder, addr1 } = await loadFixture(deployFixture);
        const mintValue = 100n;
        const startTime = BigInt((await ethers.provider.getBlock("latest")).timestamp);
        const duration = 600;
        const endTime = startTime + BigInt(duration);
        const id = 1;

        await iceCube.connect(admin).mint(addr1.address, holder.address, mintValue, startTime, endTime);

        await expect(iceCube.connect(admin).redeem(id)).to.be.revertedWith("Cannot redeem an active Ice Cube.");
    });

    it("Should get ice cube creator balance", async function () {
        const { iceCube, admin, holder, addr1, addr2 } = await loadFixture(deployFixture);
        
        const mintValue = 100n;
        const startTime = BigInt((await ethers.provider.getBlock("latest")).timestamp);
        const duration = 600n;
        const endTime = startTime + duration;
        
        await iceCube.connect(admin).mint(addr1.address, holder.address, mintValue, startTime, endTime);
        await iceCube.connect(admin).mint(addr2.address, holder.address, mintValue, startTime, endTime);
        await iceCube.connect(admin).mint(addr1.address, holder.address, mintValue, startTime, endTime);

        expect(await iceCube.balanceOf(holder.address)).to.equal(BigInt(3));

        expect(await iceCube.getCreatorBalanceOf(addr1.address)).to.equal(BigInt(2));
        expect(await iceCube.getCreatorBalanceOf(addr2.address)).to.equal(BigInt(1));
        expect(await iceCube.getCreatorBalanceOf(admin.address)).to.equal(BigInt(0));
        
        expect(await iceCube.getCreatorCubeIdByIndex(addr1.address, 0)).to.equal(BigInt(1));
        expect(await iceCube.getCreatorCubeIdByIndex(addr2.address, 0)).to.equal(BigInt(2));
        expect(await iceCube.getCreatorCubeIdByIndex(addr1.address, 1)).to.equal(BigInt(3));

        await expect(iceCube.getCreatorCubeIdByIndex(addr1.address, 2)).to.be.revertedWith("Index out of range"); 
    });

    /***************************
 
      CLAIM REWARD
 
    ****************************/

    it("Should claim reward", async function () {
        const { iceCube, admin, holder, addr1 } = await loadFixture(deployFixture);
        const mintValue = 100n;
        const startTime = BigInt((await ethers.provider.getBlock("latest")).timestamp);
        const duration = 600;
        const endTime = startTime + BigInt(duration);
        const id = 1;

        await iceCube.connect(admin).mint(addr1.address, holder.address, mintValue, startTime, endTime);
        await iceCube.connect(admin).claimRewards(id);

        expect(await iceCube.getLastRewardTime(id)).to.be.gt(startTime);
    });

    it("Should not claim reward when paused", async function () {
        const { iceCube, admin, holder, addr1 } = await loadFixture(deployFixture);
        const mintValue = 100n;
        const startTime = BigInt((await ethers.provider.getBlock("latest")).timestamp);
        const duration = 600;
        const endTime = startTime + BigInt(duration);
        const id = 1;

        await iceCube.connect(admin).mint(addr1.address, holder.address, mintValue, startTime, endTime);

        await iceCube.connect(admin).pause();

        await expect(iceCube.connect(admin).claimRewards(id)).to.be.revertedWith("Pausable: paused");
    });

    it("Should not claim reward on non-existent ice cube", async function () {
        const { iceCube, admin } = await loadFixture(deployFixture);
        const id = 1;

        await expect(iceCube.connect(admin).claimRewards(id)).to.be.revertedWith("Invalid IceCube ID.");
    });

    it("Should not let unauthorized address claim reward", async function () {
        const { iceCube, admin, holder, addr1 } = await loadFixture(deployFixture);
        const mintValue = 100n;
        const startTime = BigInt((await ethers.provider.getBlock("latest")).timestamp);
        const duration = 600;
        const endTime = startTime + BigInt(duration);
        const id = 1;

        await iceCube.connect(admin).mint(addr1.address, holder.address, mintValue, startTime, endTime);

        await expect(iceCube.connect(holder).claimRewards(id)).to.be.reverted;
    });

    /***************************
 
      TRANSFER
 
    ****************************/

    it("Should transfer", async function () {
        const { iceCube, admin, holder, addr1, addr2 } = await loadFixture(deployFixture);
        const mintValue = 100n;
        const startTime = BigInt((await ethers.provider.getBlock("latest")).timestamp);
        const duration = 600;
        const endTime = startTime + BigInt(duration);
        const id = 1;

        await iceCube.connect(admin).mint(addr1.address, holder.address, mintValue, startTime, endTime);

        await iceCube.connect(holder)['safeTransferFrom(address,address,uint256)'](holder.address, addr2.address, id);

        expect(await iceCube.ownerOf(id)).to.equal(addr2.address);
    });

    it("Should not transfer when paused", async function () {
        const { iceCube, admin, holder, addr1, addr2 } = await loadFixture(deployFixture);
        const mintValue = 100n;
        const startTime = BigInt((await ethers.provider.getBlock("latest")).timestamp);
        const duration = 600;
        const endTime = startTime + BigInt(duration);
        const id = 1;

        await iceCube.connect(admin).mint(addr1.address, holder.address, mintValue, startTime, endTime);

        await iceCube.connect(admin).pause();

        await expect(iceCube.connect(holder)['safeTransferFrom(address,address,uint256)'](holder.address, addr2.address, id)).to.be.revertedWith("Pausable: paused");
    });

    /***************************
 
      PAUSE
 
    ****************************/

    it("Should not let non-admin pause or unpause", async function () {
        const { iceCube, admin, addr1 } = await loadFixture(deployFixture);

        await expect(iceCube.connect(addr1).pause()).to.be.reverted;
        await iceCube.connect(admin).pause();
        await expect(iceCube.connect(addr1).unpause()).to.be.reverted;
    });

    /***************************
 
      APPROVED
 
    ****************************/

    it("Should set approved", async function () {
        const { iceCube, admin, holder, addr1, addr2 } = await loadFixture(deployFixture);
        const mintValue = 100n;
        const startTime = BigInt((await ethers.provider.getBlock("latest")).timestamp);
        const duration = 600;
        const endTime = startTime + BigInt(duration);
        const id = 1;

        await iceCube.connect(admin).mint(addr1.address, holder.address, mintValue, startTime, endTime);
        await iceCube.connect(holder).approve(addr2.address, id);

        expect(await iceCube.isApprovedOrOwner(holder.address, id)).to.equal(true);
        expect(await iceCube.isApprovedOrOwner(addr2.address, id)).to.equal(true);
    });

    /***************************

      SUPPORTS INTERFACE

    ****************************/

    it("Should correctly indicate supported interfaces", async function () {
        const { iceCube } = await loadFixture(deployFixture);
        const idForIERC721EnumerableUpgradeable = 0x780e9d63;
        const idForIERC721Upgradeable = 0x80ac58cd;
        const idForIERC721MetadataUpgradeable = 0x5b5e139f;
        const idForIERC165Upgradeable = 0x01ffc9a7;
        const idForIERC20Upgradeable = 0x36372b07;

        expect(await iceCube.supportsInterface(idForIERC721EnumerableUpgradeable)).to.equal(true);
        expect(await iceCube.supportsInterface(idForIERC721Upgradeable)).to.equal(true);
        expect(await iceCube.supportsInterface(idForIERC721MetadataUpgradeable)).to.equal(true);
        expect(await iceCube.supportsInterface(idForIERC165Upgradeable)).to.equal(true);
        expect(await iceCube.supportsInterface(idForIERC20Upgradeable)).to.equal(false);
    });

    /***************************
 
      GETTERS
 
    ****************************/

    it("Should not return invalid getters", async function () {
        const { iceCube } = await loadFixture(deployFixture);
        const id = 1;

        await expect(iceCube.isRedeemed(id)).to.be.revertedWith("Invalid IceCube ID.");
        await expect(iceCube.getRedeemer(id)).to.be.revertedWith("Invalid IceCube ID.");
        await expect(iceCube.getAmount(id)).to.be.revertedWith("Invalid IceCube ID.");
        await expect(iceCube.getStartTime(id)).to.be.revertedWith("Invalid IceCube ID.");
        await expect(iceCube.getEndTime(id)).to.be.revertedWith("Invalid IceCube ID.");
        await expect(iceCube.getLastRewardTime(id)).to.be.revertedWith("Invalid IceCube ID.");
    });
});
