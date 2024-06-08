/* global BigInt */
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");
require('solidity-coverage');

describe("ETH Virtual Pool test", function () {
    async function deployFixture() {
        const MockEthVirtualPool = await ethers.getContractFactory("MockEthVirtualPool");

        const [ethSource, caller, addr1, addr2] = await ethers.getSigners();

        // Deploy MockEthVirtualPool
        const initialPoolSize = BigInt(ethers.utils.parseUnits("100", "ether"));
        
        const virtualPool = await upgrades.deployProxy(
            MockEthVirtualPool,
            [initialPoolSize, initialPoolSize],
            {kind: 'uups'}
        );

        // Make the caller the owner of the virtual pool.
        await virtualPool.transferOwnership(caller.address);

        // Initialize the pool with the right amount of eth
        await virtualPool.connect(ethSource).deposit({value: initialPoolSize});

        return { virtualPool, caller, addr1, addr2 };
    }

    /***************************
     
      SWAPS
     
    ****************************/

    it("Should swapAB", async function () {
        const { virtualPool, caller } = await loadFixture(deployFixture);

        const swapValue = BigInt(ethers.utils.parseUnits("100", "ether"));
        const sendValue = BigInt(ethers.utils.parseUnits("101", "ether"));
        const minOut = BigInt(ethers.utils.parseUnits("50", "ether"));
        const deadline = BigInt((await ethers.provider.getBlock("latest")).timestamp) + 600n;
        const oneEEighteen = BigInt(ethers.utils.parseUnits("1", "ether"));
        const initialCallerBalance = BigInt(await ethers.provider.getBalance(caller.address));
        const initialPoolBalance = BigInt(await ethers.provider.getBalance(virtualPool.address));
    
        const sizeA = BigInt(await virtualPool.poolSizeA());
        const sizeB = BigInt(await virtualPool.poolSizeB());
        const previewOut = BigInt(await virtualPool.previewSwapAB(swapValue));
        await virtualPool.connect(caller).swapAB(caller.address, swapValue, minOut, deadline, {value: sendValue} );
        
        const finalCallerBalance = BigInt(await ethers.provider.getBalance(caller.address));
        const finalPoolBalance = BigInt(await ethers.provider.getBalance(virtualPool.address));

        // Check if at least some change came back - the gas cost doesn't allow exact comparisons
        expect(finalCallerBalance > initialCallerBalance - sendValue).to.be.true;
        expect(finalCallerBalance < initialCallerBalance - swapValue).to.be.true;

        expect(finalPoolBalance).to.be.equal(initialPoolBalance + swapValue);

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
        const { virtualPool, caller } = await loadFixture(deployFixture);

        const swapValue = BigInt(ethers.utils.parseUnits("100", "ether"));
        const minOut = BigInt(ethers.utils.parseUnits("50", "ether"));
        const deadline = BigInt((await ethers.provider.getBlock("latest")).timestamp) + 600n;
        const oneEEighteen = BigInt(ethers.utils.parseUnits("1", "ether"));
        const initialCallerBalance = BigInt(await ethers.provider.getBalance(caller.address));
        const initialPoolBalance = BigInt(await ethers.provider.getBalance(virtualPool.address));

        const sizeA = BigInt(await virtualPool.poolSizeA());
        const sizeB = BigInt(await virtualPool.poolSizeB());
        const previewOut = BigInt(await virtualPool.previewSwapBA(swapValue));
        await virtualPool.connect(caller).swapBA(caller.address, swapValue, minOut, deadline);

        const finalCallerBalance = BigInt(await ethers.provider.getBalance(caller.address));
        const finalPoolBalance = BigInt(await ethers.provider.getBalance(virtualPool.address));

        // Check if the expected eth arrived to the caller - the gas cost doesn't allow exact comparisons
        expect(finalCallerBalance > initialCallerBalance).to.be.true;
        expect(finalCallerBalance < initialCallerBalance + previewOut).to.be.true;

        expect(finalPoolBalance).to.be.equal(initialPoolBalance - previewOut);

        expect(await virtualPool.poolSizeB()).to.equal(sizeB + swapValue);
        expect(await virtualPool.poolSizeA()).to.equal(sizeA - previewOut);
        expect(await virtualPool.poolSizeA()).to.equal(sizeA - minOut);
        const newSizeA = BigInt(await virtualPool.poolSizeA());
        const newSizeB = BigInt(await virtualPool.poolSizeB());
        expect(await newSizeA * newSizeB).to.equal(sizeA * sizeB);
        expect(await virtualPool.priceB()).to.equal(oneEEighteen * (sizeA - minOut) / (sizeB + swapValue));
        expect(await virtualPool.priceA()).to.equal(oneEEighteen * (sizeB + swapValue) / (sizeA - minOut));
    });

});
