/* global BigInt */
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");
require('solidity-coverage');

describe("Controller test", function () {
    async function deployFixture() {
        const Controller = await ethers.getContractFactory("Controller");
        const IceToken = await ethers.getContractFactory("IceToken");
        const H2OToken = await ethers.getContractFactory("H2OToken");
        const IceCube = await ethers.getContractFactory("IceCube");
        const H2OIceVirtualPool = await ethers.getContractFactory("H2OIceVirtualPool");
        const MockETHRevertAttack = await ethers.getContractFactory("MockETHRevertAttack");

        const [owner, admin, holder, addr1, addr2] = await ethers.getSigners();

        const controller = await upgrades.deployProxy(
            Controller, 
            {kind: 'uups'} );

        // The admin accounts of the tokens
        const admins = [admin.address, controller.address]

        // Deploy IceToken
        const ice = await upgrades.deployProxy(
            IceToken,
            [admins, holder.address],
            {kind: 'uups'} );

        // Deploy H2OToken
        const h2o = await upgrades.deployProxy(
            H2OToken,
            [admins, holder.address],
            {kind: 'uups'} );

        // Deploy IceCube
        const iceCube = await upgrades.deployProxy(
            IceCube,
            [admins],
            {kind: 'uups'} );

         // Deploy IcePool
         const icePool = await upgrades.deployProxy(
            H2OIceVirtualPool,
            [h2o.address, ice.address, controller.address],
             { kind: 'uups' });

        const mockETHRevertAttack = await MockETHRevertAttack.deploy(controller.address);

        await mockETHRevertAttack.deployed();

        // Set the tokens in the Controller.
        await controller.setTokens(ice.address, h2o.address, iceCube.address, icePool.address);

        await holder.sendTransaction({
            to: controller.address,
            data: "0x",
            value: 100,
        });

        await holder.sendTransaction({
            to: mockETHRevertAttack.address,
            data: "0x",
            value: ethers.utils.parseUnits("1", "ether"),
        });

        return { controller, ice, h2o, iceCube, icePool, mockETHRevertAttack, owner, admin, holder, addr1, addr2 };
    }

    //***************************
    // 
    //  SETUP/DEPLOYMENT
    // 
    //****************************

    it("Should deploy tokens to holder", async function () {
        const { ice, h2o, holder } = await loadFixture(deployFixture);

        const holderIceBalance = await ice.balanceOf(holder.address);
        expect(await ice.totalSupply()).to.equal(holderIceBalance);

        const holderH2OBalance = await h2o.balanceOf(holder.address);
        expect(await h2o.totalSupply()).to.equal(holderH2OBalance);

    });

    it("Should have only listed admins", async function () {
        const { ice, h2o, iceCube } = await loadFixture(deployFixture);
        
        expect(await ice.getRoleMemberCount(ice.DEFAULT_ADMIN_ROLE())).to.equal(2);
        expect(await h2o.getRoleMemberCount(h2o.DEFAULT_ADMIN_ROLE())).to.equal(2);
        expect(await iceCube.getRoleMemberCount(h2o.DEFAULT_ADMIN_ROLE())).to.equal(2);
    });

    it("Should not set tokens again", async function () {
        const { controller, ice, h2o, iceCube, icePool } = await loadFixture(deployFixture);

        await expect(controller.setTokens(ice.address, h2o.address, iceCube.address, icePool.address)).to.be.revertedWith("TOKENS_ALREADY_SET");
    });

    it("Should not let non-owner set tokens or pause", async function() {
        const { controller, ice, h2o, iceCube, icePool, holder } = await loadFixture(deployFixture);

        await expect(controller.connect(holder).setTokens(ice.address, h2o.address, iceCube.address, icePool.address)).to.be.revertedWith("Ownable: caller is not the owner");
        await expect(controller.connect(holder).pause(true)).to.be.revertedWith("Ownable: caller is not the owner");
        await expect(controller.connect(holder).unpause(true)).to.be.revertedWith("Ownable: caller is not the owner");
    })

    //***************************
    // 
    //  CLAIM REWARDS
    // 
    //****************************

    it("Should claim rewards via controller", async function () {
        const { controller, h2o, holder } = await loadFixture(deployFixture);

        const holderH2OBalance = BigInt(await h2o.balanceOf(holder.address));
        await ethers.provider.send('evm_increaseTime', [31536000]);
        await ethers.provider.send('evm_mine');
        const claimableH2O = await controller.connect(holder).claimableH2OFromICE();
        await controller.connect(holder).claimRewards();
        expect(await claimableH2O).to.be.gt(0n);
        expect(await h2o.balanceOf(holder.address)).to.be.gt(BigInt(claimableH2O) + holderH2OBalance);
    });

    it("Should not allow users to claim rewards directly from tokens", async function () {
        const { ice, owner, admin, holder } = await loadFixture(deployFixture);

        await expect(ice.connect(owner).claimReward(holder.address)).to.be.reverted;
        await expect(ice.connect(admin).claimReward(holder.address)).to.be.reverted;
        await expect(ice.connect(holder).claimReward(holder.address)).to.be.reverted;
    });

    it("Should not claim rewards when paused", async function () {
        const { controller, holder } = await loadFixture(deployFixture);

        await controller.pause(true);
        await expect(controller.connect(holder).claimRewards()).to.be.revertedWith("Pausable: paused");
    });

    //***************************
    // 
    //  SWAPS
    // 
    //****************************

    it("Should swap H2O for Ice in virtual pool", async function () {
        const { controller, ice, h2o, holder } = await loadFixture(deployFixture);

        const holderH2O = BigInt(await h2o.balanceOf(holder.address));
        const holderIce = BigInt(await ice.balanceOf(holder.address));
        const previewedSwap = BigInt(await controller.connect(holder).previewSwapH2OForICE(100));
        const timeStamp = BigInt((await ethers.provider.getBlock("latest")).timestamp) + 600n;
        await controller.connect(holder).swapH2OForICE(100, 0, timeStamp);

        expect(await h2o.balanceOf(holder.address)).to.equal(holderH2O - 100n);
        expect(await ice.balanceOf(holder.address)).to.equal(holderIce + previewedSwap);
    });

    it("Should swap Ice for H2O in virtual pool", async function () {
        const { controller, ice, h2o, holder } = await loadFixture(deployFixture);

        const holderH2O = BigInt(await h2o.balanceOf(holder.address));
        const holderIce = BigInt(await ice.balanceOf(holder.address));
        const previewedSwap = BigInt(await controller.connect(holder).previewSwapICEForH2O(100));
        const timeStamp = BigInt((await ethers.provider.getBlock("latest")).timestamp) + 600n;
        await controller.connect(holder).swapICEForH2O(100, 0, timeStamp); //@audit Name style

        expect(await h2o.balanceOf(holder.address)).to.equal(holderH2O + previewedSwap);
        expect(await ice.balanceOf(holder.address)).to.equal(holderIce - 100n);
    });

    it("Should not swap when paused and swap when unpaused", async function () {
        const { controller, ice, h2o, holder } = await loadFixture(deployFixture);

        await controller.pause(true); //@audit Should the admin be pausing rather than owner?
        const timeStamp = BigInt((await ethers.provider.getBlock("latest")).timestamp) + 600n;
        await expect(controller.connect(holder).swapH2OForICE(100, 0, timeStamp)).to.be.revertedWith("Pausable: paused");
        await expect(controller.connect(holder).swapICEForH2O(100, 0, timeStamp)).to.be.revertedWith("Pausable: paused");

        await controller.unpause(true);
        const holderH2O = BigInt(await h2o.balanceOf(holder.address));
        const holderIce = BigInt(await ice.balanceOf(holder.address));
        const previewedSwap = BigInt(await controller.connect(holder).previewSwapH2OForICE(100));

        await controller.connect(holder).swapH2OForICE(100, 0, timeStamp);

        expect(await h2o.balanceOf(holder.address)).to.equal(holderH2O - 100n);
        expect(await ice.balanceOf(holder.address)).to.equal(holderIce + previewedSwap);
    });

    //**************************
    // 
    //  SETTERS/GETTERS
    // 
    //****************************

    it("Should let owner set melt rate", async function () {
        const { controller } = await loadFixture(deployFixture);

        await controller.setMeltRate(10);

        expect(await controller.annualMeltRate()).to.equal(10 * 31536000);
    });

    it("Should not let non-owner set melt rate", async function () {
        const { controller, holder } = await loadFixture(deployFixture);

        await expect(controller.connect(holder).setMeltRate(10)).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should let owner set error update period", async function () {
        const { controller } = await loadFixture(deployFixture);

        await controller.setErrorUpdatePeriod(10);

        expect(await controller.iErrorUpdatePeriod()).to.equal(10);
    });

    it("Should not let non-owner set melt rate", async function () {
        const { controller, holder } = await loadFixture(deployFixture);

        await expect(controller.connect(holder).setErrorUpdatePeriod(10)).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should get prices (ice swaps)", async function () {
        const { controller, holder } = await loadFixture(deployFixture);
        const oneEEighteen = BigInt(ethers.utils.parseUnits("1", "ether"));
        const purchaseAmount = 1000n * oneEEighteen;
        const thirtyDaysPlusOne = 30 * 86400 + 1;

        expect(BigInt(await controller.getICEPrice())).to.equal(oneEEighteen);

        const timeStamp1 = BigInt((await ethers.provider.getBlock("latest")).timestamp) + 600n;
        await network.provider.send("evm_setAutomine", [false]);
        await controller.connect(holder).swapICEForH2O(purchaseAmount, 0, timeStamp1);
        await controller.connect(holder).swapICEForH2O(purchaseAmount, 0, timeStamp1);
        await ethers.provider.send('evm_mine');
        await network.provider.send("evm_setAutomine", [true]);
        const priceAfterSwap = BigInt(await controller.getICEPrice());
        
        await ethers.provider.send('evm_increaseTime', [thirtyDaysPlusOne]);
        await ethers.provider.send('evm_mine');

        const timeStamp2 = BigInt((await ethers.provider.getBlock("latest")).timestamp) + 600n;
        await controller.connect(holder).swapICEForH2O(oneEEighteen, 0, timeStamp2);

        expect(BigInt(await controller.getAverageICEPrice())).to.equal(priceAfterSwap);
    });

    it("Should get prices (H2O swaps)", async function () {
        const { controller, holder } = await loadFixture(deployFixture);
        const oneEEighteen = BigInt(ethers.utils.parseUnits("1", "ether"));
        const purchaseAmount = 1000n * oneEEighteen;
        const thirtyDaysPlusOne = 30 * 86400 + 1;

        expect(BigInt(await controller.getICEPrice())).to.equal(oneEEighteen);

        const timeStamp1 = BigInt((await ethers.provider.getBlock("latest")).timestamp) + 600n;
        await controller.connect(holder).swapH2OForICE(purchaseAmount, 0, timeStamp1);
        const priceAfterSwap = BigInt(await controller.getICEPrice());

        await ethers.provider.send('evm_increaseTime', [thirtyDaysPlusOne]);
        await ethers.provider.send('evm_mine');

        const timeStamp2 = BigInt((await ethers.provider.getBlock("latest")).timestamp) + 600n;
        await controller.connect(holder).swapH2OForICE(oneEEighteen, 0, timeStamp2);

        expect(BigInt(await controller.getAverageICEPrice())).to.equal(priceAfterSwap);
    });

    it("Should get pool sizes", async function () {
        const { controller } = await loadFixture(deployFixture);
        const oneEEighteen = BigInt(ethers.utils.parseUnits("1", "ether"));
        const initialPoolSize = 100000n * oneEEighteen;

        expect(await controller.getICEPoolICESize()).to.equal(initialPoolSize);
        expect(await controller.getICEPoolH2OSize()).to.equal(initialPoolSize);
    });

    //***************************
    // 
    //  AUCTIONS
    // 
    //****************************

    it("Should initiate positive auction", async function () {
        const { controller, holder} = await loadFixture(deployFixture);
        const bidValue = 100n;

        const timeStamp = BigInt((await ethers.provider.getBlock("latest")).timestamp) + 600n;
        await controller.connect(holder).swapH2OForICE(100, 0, timeStamp);

        const holderETH = BigInt(await ethers.provider.getBalance(holder.address));
        const tx = await controller.connect(holder).initiatePositiveAuction({value: bidValue});
        const receipt = await tx.wait();
        const gasSpent = BigInt(receipt.gasUsed.mul(receipt.effectiveGasPrice));

        expect(await controller.isPositiveAuctionActive()).to.equal(true);
        expect(BigInt(await ethers.provider.getBalance(holder.address))).to.equal(holderETH - bidValue - gasSpent);
    });

    it("Should make valid positive auction bid", async function () {
        const { controller, holder, addr1 } = await loadFixture(deployFixture);
        const firstBidValue = 100n;
        const secondBidValue = 200n;

        const timeStamp = BigInt((await ethers.provider.getBlock("latest")).timestamp) + 600n;
        await controller.connect(holder).swapH2OForICE(100, 0, timeStamp);

        await controller.connect(holder).initiatePositiveAuction({value: firstBidValue});

        await expect(controller.connect(addr1).makePositiveAuctionBid({ value: firstBidValue })).to.be.revertedWith("New bid must be more than previous bid.");

        const holderETH = BigInt(await ethers.provider.getBalance(holder.address));
        const addr1ETH = BigInt(await ethers.provider.getBalance(addr1.address));
        const tx = await controller.connect(addr1).makePositiveAuctionBid({value: secondBidValue});
        const receipt = await tx.wait();
        const gasSpent = BigInt(receipt.gasUsed.mul(receipt.effectiveGasPrice));

        expect(await controller.leadingBidder()).to.equal(addr1.address);
        expect(await controller.dLeadingBid()).to.equal(secondBidValue);
        expect(BigInt(await ethers.provider.getBalance(addr1.address))).to.equal(addr1ETH - secondBidValue - gasSpent);
        expect(BigInt(await ethers.provider.getBalance(holder.address))).to.equal(holderETH + firstBidValue);
    });

    it("Should terminate positive auction at appropriate time", async function () {
        const { controller, h2o, holder } = await loadFixture(deployFixture);
        const bidValue = 100n;
        const thirtyOneDaysPlusOne = 31 * 86400 + 1;
        
        const timeStamp = BigInt((await ethers.provider.getBlock("latest")).timestamp) + 600n;
        await controller.connect(holder).swapH2OForICE(100, 0, timeStamp);

        await controller.connect(holder).initiatePositiveAuction({value: bidValue});

        const holderH2O = BigInt(await h2o.balanceOf(holder.address));
        const auctionAmount = BigInt(await controller.dAuctionH2OAmount());

        await expect(controller.connect(holder).terminatePositiveAuction()).to.be.revertedWith("There is still time remaining in the Auction.");

        await ethers.provider.send('evm_increaseTime', [thirtyOneDaysPlusOne]);
        await ethers.provider.send('evm_mine');

        await controller.connect(holder).terminatePositiveAuction();

        expect(BigInt(await h2o.balanceOf(holder.address))).to.equal(holderH2O + auctionAmount);
        expect(await controller.isPositiveAuctionActive()).to.equal(false);
    });

    it("Should make positive auction bid and close", async function () {
        const { controller, holder, addr1, h2o } = await loadFixture(deployFixture);
        const firstBidValue = 100n;
        const secondBidValue = 200n;
        const thirtyDaysPlusOne = 30 * 86400 + 1;

        const timeStamp = BigInt((await ethers.provider.getBlock("latest")).timestamp) + 600n;
        await controller.connect(holder).swapH2OForICE(100, 0, timeStamp);

        await controller.connect(holder).initiatePositiveAuction({ value: firstBidValue });

        await ethers.provider.send('evm_increaseTime', [thirtyDaysPlusOne]);
        await ethers.provider.send('evm_mine');

        const holderETH = BigInt(await ethers.provider.getBalance(holder.address));
        const addr1ETH = BigInt(await ethers.provider.getBalance(addr1.address));
        const addr1H2O = BigInt(await h2o.balanceOf(addr1.address));
        const auctionAmount = BigInt(await controller.dAuctionH2OAmount());
        const tx = await controller.connect(addr1).makePositiveAuctionBid({ value: secondBidValue });
        const receipt = await tx.wait();
        const gasSpent = BigInt(receipt.gasUsed.mul(receipt.effectiveGasPrice));

        expect(BigInt(await ethers.provider.getBalance(addr1.address))).to.equal(addr1ETH - secondBidValue - gasSpent);
        expect(BigInt(await ethers.provider.getBalance(holder.address))).to.equal(holderETH + firstBidValue);
        expect(BigInt(await h2o.balanceOf(addr1.address))).to.equal(addr1H2O + auctionAmount);
        expect(await controller.isPositiveAuctionActive()).to.equal(false);
    });

    it("Should initiate negative auction", async function () {
        const { controller, h2o, holder } = await loadFixture(deployFixture);
        const bidValue = 100n

        const timeStamp = BigInt((await ethers.provider.getBlock("latest")).timestamp) + 600n;
        await controller.connect(holder).swapICEForH2O(100, 0, timeStamp);

        const targetSupply = BigInt(await controller.dTargetH2OSupply());
        const totalSupply = BigInt(await h2o.totalSupply());
        const h2oAmount = totalSupply - targetSupply;
        const holderH2O = BigInt(await h2o.balanceOf(holder.address));
        await controller.connect(holder).initiateNegativeAuction(h2oAmount, bidValue);
        const auctionAmount = BigInt(await controller.dAuctionH2OAmount());

        expect(await controller.isNegativeAuctionActive()).to.equal(true);
        expect(BigInt(await h2o.balanceOf(holder.address))).to.equal(holderH2O - auctionAmount);
    });

    it("Should make valid negative auction bid", async function () {
        const { controller, h2o, holder, addr1 } = await loadFixture(deployFixture);
        const firstBidValue = 100n;
        const secondBidValue = 50n;

        const timeStamp = BigInt((await ethers.provider.getBlock("latest")).timestamp) + 600n;
        await controller.connect(holder).swapICEForH2O(100, 0, timeStamp);

        const targetSupply = BigInt(await controller.dTargetH2OSupply());
        const totalSupply = BigInt(await h2o.totalSupply());
        const h2oAmount = totalSupply - targetSupply;
        await controller.connect(holder).initiateNegativeAuction(h2oAmount, firstBidValue);
        await h2o.connect(holder).transfer(addr1.address, 500);

        await expect(controller.connect(addr1).makeNegativeAuctionBid(0, firstBidValue)).to.be.revertedWith("New bid must be less than previous bid.");

        const holderH2O = BigInt(await h2o.balanceOf(holder.address));
        const addr1H2O = BigInt(await h2o.balanceOf(addr1.address));
        const auctionAmount = BigInt(await controller.dAuctionH2OAmount());
        await controller.connect(addr1).makeNegativeAuctionBid(0, secondBidValue);

        expect(await controller.leadingBidder()).to.equal(addr1.address);
        expect(await controller.dLeadingBid()).to.equal(secondBidValue);
        expect(BigInt(await h2o.balanceOf(addr1.address))).to.equal(addr1H2O - auctionAmount);
        expect(BigInt(await h2o.balanceOf(holder.address))).to.equal(holderH2O + auctionAmount);
    });

    it("Should terminate negative auction at appropriate time", async function () {
        const { controller, h2o, holder } = await loadFixture(deployFixture);
        const bidValue = 100n;
        const thirtyOneDaysPlusOne = 31 * 86400 + 1;
        
        const timeStamp = BigInt((await ethers.provider.getBlock("latest")).timestamp) + 600n;
        await controller.connect(holder).swapICEForH2O(100, 0, timeStamp);

        const targetSupply = BigInt(await controller.dTargetH2OSupply());
        const totalSupply = BigInt(await h2o.totalSupply());
        const h2oAmount = totalSupply - targetSupply;
        await controller.connect(holder).initiateNegativeAuction(h2oAmount, bidValue);

        await expect(controller.connect(holder).terminateNegativeAuction()).to.be.revertedWith("There is still time remaining in the Auction");

        await ethers.provider.send('evm_increaseTime', [thirtyOneDaysPlusOne]);
        await ethers.provider.send('evm_mine');

        const holderETH = BigInt(await ethers.provider.getBalance(holder.address));
        const tx = await controller.connect(holder).terminateNegativeAuction();
        const receipt = await tx.wait();
        const gasSpent = BigInt(receipt.gasUsed.mul(receipt.effectiveGasPrice));

        expect(BigInt(await ethers.provider.getBalance(holder.address))).to.equal(holderETH + bidValue - gasSpent);
        expect(await controller.isNegativeAuctionActive()).to.equal(false);
    });

    it("Should make negative auction bid and close", async function () {
        const { controller, h2o, holder, addr1 } = await loadFixture(deployFixture);
        const firstBidValue = 100n;
        const secondBidValue = 50n;
        const thirtyDaysPlusOne = 30 * 86400 + 1;

        const timeStamp = BigInt((await ethers.provider.getBlock("latest")).timestamp) + 600n;
        await controller.connect(holder).swapICEForH2O(100, 0, timeStamp);

        const targetSupply = BigInt(await controller.dTargetH2OSupply());
        const totalSupply = BigInt(await h2o.totalSupply());
        const h2oAmount = totalSupply - targetSupply;
        await controller.connect(holder).initiateNegativeAuction(h2oAmount, firstBidValue);
        await h2o.connect(holder).transfer(addr1.address, 500);

        await ethers.provider.send('evm_increaseTime', [thirtyDaysPlusOne]);
        await ethers.provider.send('evm_mine');

        const holderH2O = BigInt(await h2o.balanceOf(holder.address));
        const addr1H2O = BigInt(await h2o.balanceOf(addr1.address));
        const auctionAmount = BigInt(await controller.dAuctionH2OAmount());
        const addr1ETH = BigInt(await ethers.provider.getBalance(addr1.address));
        const tx = await controller.connect(addr1).makeNegativeAuctionBid(0, secondBidValue);
        const receipt = await tx.wait();
        const gasSpent = BigInt(receipt.gasUsed.mul(receipt.effectiveGasPrice));

        expect(BigInt(await h2o.balanceOf(addr1.address))).to.equal(addr1H2O - auctionAmount);
        expect(BigInt(await h2o.balanceOf(holder.address))).to.equal(holderH2O + auctionAmount);
        expect(BigInt(await ethers.provider.getBalance(addr1.address))).to.equal(addr1ETH + secondBidValue - gasSpent);
        expect(await controller.isNegativeAuctionActive()).to.equal(false);
    });

    it("Should not auction when paused", async function () {
        const { controller, holder } = await loadFixture(deployFixture);
        const bidValue = 100n;
        const h2oAmount = 1n;

        await controller.pause(false);
        await expect(controller.connect(holder).initiatePositiveAuction({value: bidValue})).to.be.revertedWith("Pausable: paused");
        await expect(controller.connect(holder).makePositiveAuctionBid({value: bidValue})).to.be.revertedWith("Pausable: paused");
        await expect(controller.connect(holder).terminatePositiveAuction()).to.be.revertedWith("Pausable: paused");
        await expect(controller.connect(holder).initiateNegativeAuction(h2oAmount, bidValue)).to.be.revertedWith("Pausable: paused");
        await expect(controller.connect(holder).makeNegativeAuctionBid(h2oAmount, bidValue)).to.be.revertedWith("Pausable: paused");
        await expect(controller.connect(holder).terminateNegativeAuction()).to.be.revertedWith("Pausable: paused");
        await controller.unpause(false);
    });

    it("Should not initiate auctions under improper conditions", async function () {
        const { controller, holder } = await loadFixture(deployFixture);
        const bidValue = 100n;
        const h2oAmount = 1n;

        const timeStamp = BigInt((await ethers.provider.getBlock("latest")).timestamp) + 600n;
        await controller.connect(holder).swapICEForH2O(100, 0, timeStamp);

        await expect(controller.connect(holder).initiatePositiveAuction()).to.be.revertedWith("Auction not available.");

        await controller.connect(holder).swapH2OForICE(200, 0, timeStamp);
        await expect(controller.connect(holder).initiateNegativeAuction(h2oAmount, bidValue)).to.be.revertedWith("Auction not available.");
    });

    it("Should not initiate auctions when already active", async function () {
        const { controller, h2o, holder } = await loadFixture(deployFixture);
        const bidValue = 100n

        const timeStamp = BigInt((await ethers.provider.getBlock("latest")).timestamp) + 600n;
        await controller.connect(holder).swapICEForH2O(100, 0, timeStamp);

        const targetSupply = BigInt(await controller.dTargetH2OSupply());
        const totalSupply = BigInt(await h2o.totalSupply());
        const h2oAmount = (totalSupply - targetSupply)/2n;
        await controller.connect(holder).initiateNegativeAuction(h2oAmount, bidValue);

        await expect(controller.connect(holder).initiateNegativeAuction(h2oAmount, bidValue)).to.be.revertedWith("There is already an active auction.");

        await controller.connect(holder).swapH2OForICE(200, 0, timeStamp);
        await expect(controller.connect(holder).initiatePositiveAuction()).to.be.revertedWith("There is already an active auction.");
    });

    it("Should not initiate negative auction with insufficient contract ETH", async function () {
        const { controller, h2o, holder } = await loadFixture(deployFixture);
        const bidValue = 200n

        const timeStamp = BigInt((await ethers.provider.getBlock("latest")).timestamp) + 600n;
        await controller.connect(holder).swapICEForH2O(100, 0, timeStamp);

        const targetSupply = BigInt(await controller.dTargetH2OSupply());
        const totalSupply = BigInt(await h2o.totalSupply());
        const h2oAmount = totalSupply - targetSupply;
        await expect(controller.connect(holder).initiateNegativeAuction(h2oAmount, bidValue)).to.be.revertedWith("There is not enough ETH available.");
    });

    it("Should not make bids or terminate auction when not active", async function () {
        const { controller, holder } = await loadFixture(deployFixture);
        const bidValue = 100n;
        const h2oAmount = 1n;

        await expect(controller.connect(holder).makePositiveAuctionBid({ value: bidValue })).to.be.revertedWith("There is no active auction.");
        await expect(controller.connect(holder).makeNegativeAuctionBid(h2oAmount, bidValue)).to.be.revertedWith("There is no active auction.");
        await expect(controller.connect(holder).terminatePositiveAuction()).to.be.revertedWith("There is no active auction.");
        await expect(controller.connect(holder).terminateNegativeAuction()).to.be.revertedWith("There is no active auction.");
    });

    //***************************
    // 
    //  ICE CUBES
    // 
    //****************************

    it("Should mint ice cubes", async function () {
        const { controller, iceCube, holder, addr1 } = await loadFixture(deployFixture);
        const iceCubeAmount = 100n;
        const id = 1;

        const timeStamp = BigInt((await ethers.provider.getBlock("latest")).timestamp) + 600n;
        await controller.connect(holder).mintIceCube(iceCubeAmount, addr1.address, timeStamp);

        expect(await iceCube.isRedeemed(id)).to.equal(false);
    });

    it("Should redeem ice cube", async function () {
        const { controller, iceCube, holder, addr1 } = await loadFixture(deployFixture);
        const iceCubeAmount = 100n;
        const id = 1;

        const timeStamp = BigInt((await ethers.provider.getBlock("latest")).timestamp) + 600n;
        await controller.connect(holder).mintIceCube(iceCubeAmount, addr1.address, timeStamp);

        await ethers.provider.send('evm_increaseTime', [601]);
        await ethers.provider.send('evm_mine');

        await controller.connect(holder).redeemIceCube(id);

        expect(await iceCube.isRedeemed(id)).to.equal(true);
    });

    it("Should preview ice cube rewards", async function () {
        const { controller, h2o, iceCube, holder, addr1 } = await loadFixture(deployFixture);
        const iceCubeAmount = 100000n;
        const secondsPerYear = 31536000;
        const meltRate = BigInt(ethers.utils.parseUnits("0.02", "ether")) / BigInt(secondsPerYear);
        const oneEEighteen = BigInt(ethers.utils.parseUnits("1", "ether"));
        const id = 1;

        const timeStamp = BigInt((await ethers.provider.getBlock("latest")).timestamp + secondsPerYear);
        await controller.connect(holder).mintIceCube(iceCubeAmount, addr1.address, timeStamp);

        // The evm resulting time will be a few milliseconds after the timeStamp
        // above.
        await ethers.provider.send('evm_increaseTime', [secondsPerYear]);
        await ethers.provider.send('evm_mine');

        // The expected exact value is close to 2000, but the difference in
        // millis mentioned above will end up rounding the result to 1999.
        const amount = await controller.connect(addr1).previewRewardsFromCube(id);
        expect(amount).to.equal(BigInt(1999));
    });

    it("Should claim ice cube rewards", async function () {
        const { controller, h2o, iceCube, holder, addr1 } = await loadFixture(deployFixture);
        const iceCubeAmount = 500000n;
        const secondsPerYear = 31536000;
        const meltRate = BigInt(ethers.utils.parseUnits("0.02", "ether")) / BigInt(secondsPerYear);
        const oneEEighteen = BigInt(ethers.utils.parseUnits("1", "ether"));
        const id = 1;

        const timeStamp = BigInt((await ethers.provider.getBlock("latest")).timestamp + secondsPerYear);
        await controller.connect(holder).mintIceCube(iceCubeAmount, addr1.address, timeStamp);

        await ethers.provider.send('evm_increaseTime', [secondsPerYear]);
        await ethers.provider.send('evm_mine');

        const addr1H2O = BigInt(await h2o.balanceOf(addr1.address));
        await controller.connect(addr1).claimRewardsFromCube(id);

        expect(BigInt(await h2o.balanceOf(addr1.address))).to.equal(addr1H2O + iceCubeAmount * meltRate * BigInt(secondsPerYear) / oneEEighteen);
        expect(await iceCube.isRedeemed(id)).to.equal(true);
    });

    it("Should claim partial ice cube rewards", async function () {
        const { controller, h2o, iceCube, holder, addr1 } = await loadFixture(deployFixture);
        const iceCubeAmount = 500000n;
        const secondsPerYear = 31536000;
        const secondsPerMonth = secondsPerYear / 12;
        const meltRate = BigInt(ethers.utils.parseUnits("0.02", "ether")) / BigInt(secondsPerYear);
        const oneEEighteen = BigInt(ethers.utils.parseUnits("1", "ether"));
        const id = 1;

        const timeStamp = BigInt((await ethers.provider.getBlock("latest")).timestamp + secondsPerYear);
        await controller.connect(holder).mintIceCube(iceCubeAmount, addr1.address, timeStamp);

        await ethers.provider.send('evm_increaseTime', [secondsPerMonth]);
        await ethers.provider.send('evm_mine');

        const addr1H2O = BigInt(await h2o.balanceOf(addr1.address));
        await controller.connect(addr1).claimRewardsFromCube(id);

        expect(BigInt(await h2o.balanceOf(addr1.address))).to.equal(addr1H2O + iceCubeAmount * meltRate * BigInt(secondsPerMonth) / oneEEighteen);
        expect(await iceCube.isRedeemed(id)).to.equal(false);
    });

    it("Should not mint or redeem when paused", async function () {
        const { controller, holder, addr1 } = await loadFixture(deployFixture);
        const iceCubeAmount = 100n;
        const id = 1;

        await controller.pause(true);
        const timeStamp = BigInt((await ethers.provider.getBlock("latest")).timestamp) + 600n;
        await expect(controller.connect(holder).mintIceCube(iceCubeAmount, addr1.address, timeStamp)).to.be.revertedWith("Pausable: paused");
        await expect(controller.connect(holder).redeemIceCube(id)).to.be.revertedWith("Pausable: paused");
    });

    it("Should not claim cube rewards when paused", async function () {
        const { controller, holder } = await loadFixture(deployFixture);
        const id = 1;

        await controller.pause(true);
        await expect(controller.connect(holder).claimRewardsFromCube(id)).to.be.revertedWith("Pausable: paused");
    });

    it("Should not let non-redeemer redeem", async function () {
        const { controller, holder, addr1 } = await loadFixture(deployFixture);
        const iceCubeAmount = 100n;
        const id = 1;

        const timeStamp = BigInt((await ethers.provider.getBlock("latest")).timestamp) + 600n;
        await controller.connect(holder).mintIceCube(iceCubeAmount, addr1.address, timeStamp);

        await ethers.provider.send('evm_increaseTime', [601]);
        await ethers.provider.send('evm_mine');

        await expect(controller.redeemIceCube(id)).to.be.revertedWith("Only the redeemer can redeem an Ice Cube.");
    });

    it("Should not let non-owner claim ice cube rewards", async function () {
        const { controller, holder, addr1 } = await loadFixture(deployFixture);
        const iceCubeAmount = 500000n;
        const secondsPerYear = 31536000;
        const id = 1;

        const timeStamp = BigInt((await ethers.provider.getBlock("latest")).timestamp + secondsPerYear);
        await controller.connect(holder).mintIceCube(iceCubeAmount, addr1.address, timeStamp);

        await ethers.provider.send('evm_increaseTime', [secondsPerYear]);
        await ethers.provider.send('evm_mine');

        await expect(controller.connect(holder).claimRewardsFromCube(id)).to.be.revertedWith("Only owner can claim rewards");
    });
    
    it("Exercise ctwon bug ICE->H2O magnitude", async function () {
        const { controller, h2o, holder } = await loadFixture(deployFixture);

        const oneEEighteen = BigInt(ethers.utils.parseUnits("1", "ether"));
        const secondsPerYear = 31536000;
        const timeStamp = BigInt((await ethers.provider.getBlock("latest")).timestamp + secondsPerYear);

        
        const sellAmount = BigInt(await controller.getICEPoolICESize()) / 2n;
        await controller.connect(holder).swapICEForH2O(sellAmount, 0, timeStamp);

        // Fast forward a bit more than 31 days
        const thirtyOneDaysPlusOne = 31 * 86400 + 1;
        await ethers.provider.send('evm_increaseTime', [thirtyOneDaysPlusOne]);
        await ethers.provider.send('evm_mine');

        await controller.connect(holder).swapICEForH2O(1, 0, timeStamp);

        // Magnitude test
        expect(await controller.dTargetH2OSupply()).to.be.gt(oneEEighteen);

        //console.log(await controller.dTargetH2OSupply());
    });

    it("Exercise ctwon bug H2O->ICE directional", async function () {
        const { controller, h2o, holder } = await loadFixture(deployFixture);

        const secondsPerYear = 31536000;
        const timeStamp = BigInt((await ethers.provider.getBlock("latest")).timestamp + secondsPerYear);
        const fifteenOneDaysPlusOne = 15 * 86400 + 1;

        const targetH2OSupplyBefore = BigInt(await controller.dTargetH2OSupply());
        
        const sellAmount = BigInt(await controller.getICEPoolICESize()) / 20n;
        await controller.connect(holder).swapH2OForICE(sellAmount, 0, timeStamp);

        // Fast forward a bit more than 15 days
        await ethers.provider.send('evm_increaseTime', [fifteenOneDaysPlusOne]);
        await ethers.provider.send('evm_mine');

        await controller.connect(holder).swapICEForH2O(100, 0, timeStamp);

        // Fast forward a bit more than 15 days
        await ethers.provider.send('evm_increaseTime', [fifteenOneDaysPlusOne]);
        await ethers.provider.send('evm_mine');

        await controller.connect(holder).swapICEForH2O(100, 0, timeStamp);

        // Directional test
        expect(await controller.dTargetH2OSupply()).to.be.gt(targetH2OSupplyBefore);

        //console.log(await controller.dTargetH2OSupply());
    });

    it("Exercise Meriadoc ETH revert attack", async function () {
        const { controller, mockETHRevertAttack, holder, addr1 } = await loadFixture(deployFixture);
        const secondBidValue = BigInt(ethers.utils.parseUnits("1", "ether"));

        const timeStamp = BigInt((await ethers.provider.getBlock("latest")).timestamp) + 600n;
        await controller.connect(holder).swapH2OForICE(100, 0, timeStamp);

        await mockETHRevertAttack.submitBid();

        await expect(controller.connect(holder).makePositiveAuctionBid({ value: secondBidValue })).not.to.be.reverted;
        expect(await controller.dLeadingBid()).to.equal(secondBidValue);

    });
    

    
});