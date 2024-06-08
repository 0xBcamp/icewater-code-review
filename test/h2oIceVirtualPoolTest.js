/* global BigInt */
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");
require('solidity-coverage');

describe("H2O Ice Virtual Pool test", function () {
    async function deployFixture() {
        const IceToken = await ethers.getContractFactory("IceToken");
        const H2OToken = await ethers.getContractFactory("H2OToken");
        const H2OIceVirtualPool = await ethers.getContractFactory("H2OIceVirtualPool");

        const [owner, admin, holder, voidController, addr1, addr2] = await ethers.getSigners();

        // The admin accounts of the tokens
        const admins = [admin.address, voidController.address]

        // Deploy IceToken
        const ice = await upgrades.deployProxy(
            IceToken,
            [admins, holder.address],
            { kind: 'uups' });

        // Deploy H2OToken
        const h2o = await upgrades.deployProxy(
            H2OToken,
            [admins, holder.address],
            { kind: 'uups' });

        // Deploy IceCube
        const icePool = await upgrades.deployProxy(
            H2OIceVirtualPool,
            [h2o.address, ice.address, voidController.address],
            { kind: 'uups' });

        await ice.connect(admin).grantRole(ice.MINTER_BURNER_ROLE(), icePool.address);
        await h2o.connect(admin).grantRole(h2o.MINTER_BURNER_ROLE(), icePool.address);

        return { ice, h2o, icePool, owner, holder, voidController, addr1, addr2 };
    }

    /***************************
     
      SWAPS
     
    ****************************/

    it("Should swapAB", async function () {
        const { icePool, voidController, holder } = await loadFixture(deployFixture);
        const swapValue = BigInt(ethers.utils.parseUnits("100000", "ether"));
        const minOut = BigInt(ethers.utils.parseUnits("50000", "ether"));
        const deadline = BigInt((await ethers.provider.getBlock("latest")).timestamp) + 600n;
        const oneEEighteen = BigInt(ethers.utils.parseUnits("1", "ether"));

        const sizeA = BigInt(await icePool.poolSizeA());
        const sizeB = BigInt(await icePool.poolSizeB());
        const previewOut = BigInt(await icePool.previewSwapAB(swapValue));
        await icePool.connect(voidController).swapAB(holder.address, swapValue, minOut, deadline);

        expect(await icePool.poolSizeA()).to.equal(sizeA + swapValue);
        expect(await icePool.poolSizeB()).to.equal(sizeB - previewOut);
        expect(await icePool.poolSizeB()).to.equal(sizeB - minOut);
        const newSizeA = BigInt(await icePool.poolSizeA());
        const newSizeB = BigInt(await icePool.poolSizeB());
        expect(await newSizeA * newSizeB).to.equal(sizeA * sizeB);
        expect(await icePool.priceA()).to.equal(oneEEighteen * (sizeB - minOut) / (sizeA + swapValue));
        expect(await icePool.priceB()).to.equal(oneEEighteen * (sizeA + swapValue) / (sizeB - minOut));
    });

    it("Should swapBA", async function () {
        const { icePool, voidController, holder } = await loadFixture(deployFixture);
        const swapValue = BigInt(ethers.utils.parseUnits("100000", "ether"));
        const minOut = BigInt(ethers.utils.parseUnits("50000", "ether"));
        const deadline = BigInt((await ethers.provider.getBlock("latest")).timestamp) + 600n;
        const oneEEighteen = BigInt(ethers.utils.parseUnits("1", "ether"));

        const sizeA = BigInt(await icePool.poolSizeA());
        const sizeB = BigInt(await icePool.poolSizeB());
        const previewOut = BigInt(await icePool.previewSwapBA(swapValue));
        await icePool.connect(voidController).swapBA(holder.address, swapValue, minOut, deadline);

        expect(await icePool.poolSizeB()).to.equal(sizeB + swapValue);
        expect(await icePool.poolSizeA()).to.equal(sizeA - previewOut);
        expect(await icePool.poolSizeA()).to.equal(sizeA - minOut);
        const newSizeA = BigInt(await icePool.poolSizeA());
        const newSizeB = BigInt(await icePool.poolSizeB());
        expect(await newSizeA * newSizeB).to.equal(sizeA * sizeB);
        expect(await icePool.priceB()).to.equal(oneEEighteen * (sizeA - minOut) / (sizeB + swapValue));
        expect(await icePool.priceA()).to.equal(oneEEighteen * (sizeB + swapValue) / (sizeA - minOut));
    });

    it("Should not swap for non-owner", async function () {
        const { icePool, addr1 } = await loadFixture(deployFixture);
        const swapValue = BigInt(ethers.utils.parseUnits("100000", "ether"));
        const minOut = BigInt(ethers.utils.parseUnits("50000", "ether"));
        const deadline = BigInt((await ethers.provider.getBlock("latest")).timestamp) + 600n;

        await expect(icePool.connect(addr1).swapAB(addr1.address, swapValue, minOut, deadline)).to.be.revertedWith("Ownable: caller is not the owner");
        await expect(icePool.connect(addr1).swapBA(addr1.address, swapValue, minOut, deadline)).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should not swap after deadline", async function () {
        const { icePool, voidController, addr1 } = await loadFixture(deployFixture);
        const swapValue = BigInt(ethers.utils.parseUnits("100000", "ether"));
        const minOut = BigInt(ethers.utils.parseUnits("50000", "ether"));
        const duration = 600;
        const deadline = BigInt((await ethers.provider.getBlock("latest")).timestamp) + BigInt(duration);

        await ethers.provider.send('evm_increaseTime', [duration + 1]);
        await ethers.provider.send('evm_mine');

        await expect(icePool.connect(voidController).swapAB(addr1.address, swapValue, minOut, deadline)).to.be.revertedWith("Deadline Expired");
        await expect(icePool.connect(voidController).swapBA(addr1.address, swapValue, minOut, deadline)).to.be.revertedWith("Deadline Expired");
    });

    it("Should not swap less than min amount", async function () {
        const { icePool, voidController, addr1 } = await loadFixture(deployFixture);
        const swapValue = BigInt(ethers.utils.parseUnits("100000", "ether"));
        const minOut = BigInt(ethers.utils.parseUnits("100000", "ether"));
        const deadline = BigInt((await ethers.provider.getBlock("latest")).timestamp) + 600n;

        await expect(icePool.connect(voidController).swapAB(addr1.address, swapValue, minOut, deadline)).to.be.revertedWith("Resulting amountB < minAmountB");
        await expect(icePool.connect(voidController).swapBA(addr1.address, swapValue, minOut, deadline)).to.be.revertedWith("Resulting amountA < minAmountA");
    });

    /***************************
     
      SCALE POOLS
     
    ****************************/

    it("Should scale pools", async function () {
        const { icePool, voidController } = await loadFixture(deployFixture);
        const targetRatio = BigInt(ethers.utils.parseUnits("2", "ether"));
        const oneEEighteen = BigInt(ethers.utils.parseUnits("1", "ether"));

        const sizeA = BigInt(await icePool.poolSizeA());
        const sizeB = BigInt(await icePool.poolSizeB());
        const priceA = BigInt(await icePool.priceA());
        const priceB = BigInt(await icePool.priceB());

        await icePool.connect(voidController).scalePools(targetRatio);

        expect(await icePool.poolSizeA()).to.equal((sizeA + sizeA * targetRatio / oneEEighteen) / 2n);
        expect(await icePool.poolSizeB()).to.equal((sizeB + sizeB * targetRatio / oneEEighteen) / 2n);
        expect(await icePool.priceA()).to.equal(priceA);
        expect(await icePool.priceB()).to.equal(priceB);
    });

    it("Should not scale pools for non-owner", async function () {
        const { icePool, addr1 } = await loadFixture(deployFixture);
        const targetRatio = BigInt(ethers.utils.parseUnits("2", "ether"));

        await expect(icePool.connect(addr1).scalePools(targetRatio)).to.be.revertedWith("Ownable: caller is not the owner");
    });

    /***************************

      GIVE AND TAKE

    ****************************/

    it("Should not give tokens to unauthorized address", async function () {
        const { ice, h2o, icePool, holder, addr1 } = await loadFixture(deployFixture);
        const attackValue = BigInt(ethers.utils.parseUnits("100000", "ether"));

        const holderABalance = BigInt(await h2o.balanceOf(holder.address));
        const holderBBalance = BigInt(await ice.balanceOf(holder.address));

        expect(function () { icePool.connect(addr1)._giveA(addr1.address, attackValue); }).to.throw;
        expect(function () { icePool.connect(addr1)._giveB(addr1.address, attackValue); }).to.throw;
        expect(function () { icePool.connect(addr1)._takeA(holder.address, attackValue); }).to.throw;
        expect(function () { icePool.connect(addr1)._takeB(holder.address, attackValue); }).to.throw;

        expect(await h2o.balanceOf(addr1.address)).to.be.lt(attackValue);
        expect(await ice.balanceOf(addr1.address)).to.be.lt(attackValue);
        expect(await h2o.balanceOf(holder.address)).to.equal(holderABalance);
        expect(await ice.balanceOf(holder.address)).to.equal(holderBBalance);
    });
});
