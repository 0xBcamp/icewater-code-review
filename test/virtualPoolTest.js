/* global BigInt */
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");
require('solidity-coverage');

describe("Virtual Pool test", function () {
    async function deployFixture() {
        const MockSimpleVirtualPool = await ethers.getContractFactory("MockSimpleVirtualPool");

        const [owner, addr1, addr2] = await ethers.getSigners();

        // Deploy MockSimpleVirtualPool
        const initialPoolSize = BigInt(ethers.utils.parseUnits("100000", "ether"));
        
        const virtualPool = await upgrades.deployProxy(
            MockSimpleVirtualPool,
            [initialPoolSize, initialPoolSize],
            {kind: 'uups'}
        );

        return { virtualPool, owner, addr1, addr2 };
    }

    /***************************
     
      SWAPS
     
    ****************************/

    it("Should swapAB", async function () {
        const { virtualPool, addr1 } = await loadFixture(deployFixture);
        const swapValue = BigInt(ethers.utils.parseUnits("100000", "ether"));
        const minOut = BigInt(ethers.utils.parseUnits("50000", "ether"));
        const deadline = BigInt((await ethers.provider.getBlock("latest")).timestamp) + 600n;
        const oneEEighteen = BigInt(ethers.utils.parseUnits("1", "ether"));

        const sizeA = BigInt(await virtualPool.poolSizeA());
        const sizeB = BigInt(await virtualPool.poolSizeB());
        const previewOut = BigInt(await virtualPool.previewSwapAB(swapValue));
        await virtualPool.swapAB(addr1.address, swapValue, minOut, deadline);

        expect(await virtualPool.poolSizeA()).to.equal(sizeA + swapValue);
        expect(await virtualPool.poolSizeB()).to.equal(sizeB - previewOut);
        expect(await virtualPool.poolSizeB()).to.equal(sizeB - minOut);
        const newSizeA = BigInt(await virtualPool.poolSizeA());
        const newSizeB = BigInt(await virtualPool.poolSizeB());
        expect(await newSizeA * newSizeB).to.equal(sizeA * sizeB);
        expect(await virtualPool.priceA()).to.equal(oneEEighteen * (sizeB - minOut) / (sizeA + swapValue));
        expect(await virtualPool.priceB()).to.equal(oneEEighteen * (sizeA + swapValue) / (sizeB - minOut));
    });

    it("Should swapBA", async function () {
        const { virtualPool, addr1 } = await loadFixture(deployFixture);
        const swapValue = BigInt(ethers.utils.parseUnits("100000", "ether"));
        const minOut = BigInt(ethers.utils.parseUnits("50000", "ether"));
        const deadline = BigInt((await ethers.provider.getBlock("latest")).timestamp) + 600n;
        const oneEEighteen = BigInt(ethers.utils.parseUnits("1", "ether"));

        const sizeA = BigInt(await virtualPool.poolSizeA());
        const sizeB = BigInt(await virtualPool.poolSizeB());
        const previewOut = BigInt(await virtualPool.previewSwapBA(swapValue));
        await virtualPool.swapBA(addr1.address, swapValue, minOut, deadline);

        expect(await virtualPool.poolSizeB()).to.equal(sizeB + swapValue);
        expect(await virtualPool.poolSizeA()).to.equal(sizeA - previewOut);
        expect(await virtualPool.poolSizeA()).to.equal(sizeA - minOut);
        const newSizeA = BigInt(await virtualPool.poolSizeA());
        const newSizeB = BigInt(await virtualPool.poolSizeB());
        expect(await newSizeA * newSizeB).to.equal(sizeA * sizeB);
        expect(await virtualPool.priceB()).to.equal(oneEEighteen * (sizeA - minOut) / (sizeB + swapValue));
        expect(await virtualPool.priceA()).to.equal(oneEEighteen * (sizeB + swapValue) / (sizeA - minOut));
    });

    it("Should not swap for non-owner", async function () {
        const { virtualPool, addr1 } = await loadFixture(deployFixture);
        const swapValue = BigInt(ethers.utils.parseUnits("100000", "ether"));
        const minOut = BigInt(ethers.utils.parseUnits("50000", "ether"));
        const deadline = BigInt((await ethers.provider.getBlock("latest")).timestamp) + 600n;

        await expect(virtualPool.connect(addr1).swapAB(addr1.address, swapValue, minOut, deadline)).to.be.revertedWith("Ownable: caller is not the owner");
        await expect(virtualPool.connect(addr1).swapBA(addr1.address, swapValue, minOut, deadline)).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should not swap after deadline", async function () {
        const { virtualPool, addr1 } = await loadFixture(deployFixture);
        const swapValue = BigInt(ethers.utils.parseUnits("100000", "ether"));
        const minOut = BigInt(ethers.utils.parseUnits("50000", "ether"));
        const duration = 600;
        const deadline = BigInt((await ethers.provider.getBlock("latest")).timestamp) + BigInt(duration);

        await ethers.provider.send('evm_increaseTime', [duration + 1]);
        await ethers.provider.send('evm_mine');

        await expect(virtualPool.swapAB(addr1.address, swapValue, minOut, deadline)).to.be.revertedWith("Deadline Expired");
        await expect(virtualPool.swapBA(addr1.address, swapValue, minOut, deadline)).to.be.revertedWith("Deadline Expired");
    });

    it("Should not swap less than min amount", async function () {
        const { virtualPool, addr1 } = await loadFixture(deployFixture);
        const swapValue = BigInt(ethers.utils.parseUnits("100000", "ether"));
        const minOut = BigInt(ethers.utils.parseUnits("100000", "ether"));
        const deadline = BigInt((await ethers.provider.getBlock("latest")).timestamp) + 600n;

        await expect(virtualPool.swapAB(addr1.address, swapValue, minOut, deadline)).to.be.revertedWith("Resulting amountB < minAmountB");
        await expect(virtualPool.swapBA(addr1.address, swapValue, minOut, deadline)).to.be.revertedWith("Resulting amountA < minAmountA");
    });

    /***************************
     
      SCALE POOLS
     
    ****************************/

    it("Should scale pools", async function () {
        const { virtualPool } = await loadFixture(deployFixture);
        const targetRatio = BigInt(ethers.utils.parseUnits("2", "ether"));
        const oneEEighteen = BigInt(ethers.utils.parseUnits("1", "ether"));

        const sizeA = BigInt(await virtualPool.poolSizeA());
        const sizeB = BigInt(await virtualPool.poolSizeB());
        const priceA = BigInt(await virtualPool.priceA());
        const priceB = BigInt(await virtualPool.priceB());

        await virtualPool.scalePools(targetRatio);

        expect(await virtualPool.poolSizeA()).to.equal((sizeA + sizeA * targetRatio /oneEEighteen) / 2n);
        expect(await virtualPool.poolSizeB()).to.equal((sizeB + sizeB * targetRatio /oneEEighteen) / 2n);
        expect(await virtualPool.priceA()).to.equal(priceA);
        expect(await virtualPool.priceB()).to.equal(priceB);
    });

    it("Should not scale pools for non-owner", async function () {
        const { virtualPool, addr1 } = await loadFixture(deployFixture);
        const targetRatio = BigInt(ethers.utils.parseUnits("2", "ether"));

        await expect(virtualPool.connect(addr1).scalePools(targetRatio)).to.be.revertedWith("Ownable: caller is not the owner");
    });
});
