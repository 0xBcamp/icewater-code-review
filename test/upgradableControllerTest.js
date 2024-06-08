/* global BigInt */
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
require('solidity-coverage');

//todo reuse code from here when deploying stuff
const deployUtils = require("../scripts/deployUtils.js");

describe("Upgradeable Controller test", function () {
    async function deployFixture() {
        const Controller = await ethers.getContractFactory("Controller");
        const IceToken = await ethers.getContractFactory("IceToken");
        const H2OToken = await ethers.getContractFactory("H2OToken");
        const SteamToken = await ethers.getContractFactory("SteamToken");
        const IceCube = await ethers.getContractFactory("IceCube");
        const H2OIceVirtualPool = await ethers.getContractFactory("H2OIceVirtualPool");

        const [deployer, admin, holder, addr1, addr2] = await ethers.getSigners();

        // Deploy Controller
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

        // Deploy IceCube
        const icePool = await upgrades.deployProxy(
            H2OIceVirtualPool,
            [h2o.address, ice.address, controller.address],
            {kind: 'uups'} );

        // Set the tokens in the Controller.
        await controller.setTokens(ice.address, h2o.address, iceCube.address, icePool.address);

        // Set the admin as the owner of the Controller.
        controller.transferOwnership(admin.address);

        // Deploy SteamToken
        const stm = await upgrades.deployProxy(
            SteamToken,
            [admins, holder.address],
            {kind: 'uups'} );

        return { controller, ice, h2o, stm, iceCube, icePool, deployer, admin, holder, addr1, addr2 };
    }

    async function upgradeFixtureV2() {
        const { controller, ice, h2o, stm, iceCube, icePool, deployer, admin, holder, addr1, addr2 } =
            await loadFixture(deployFixture);

        // Use the admin as the signer of this contract so that the admin is
        // used when upgrading.
        const MockController_v2 = await ethers.getContractFactory(
            "MockController_v2", signer=admin);

        // Upgrade from Controller to MockController_v2
        const controller_v2 = await upgrades.upgradeProxy(
            controller.address,
            MockController_v2,
            {kind: 'uups'} );

        // Upgrade 
        await controller_v2.upgrade();
        
        return { controller, controller_v2, ice, h2o, stm, iceCube, icePool, deployer, admin, holder, addr1, addr2 };
    }

    it("Should deploy tokens to holder", async function () {
        const { ice, h2o, holder } = await loadFixture(upgradeFixtureV2);

        const holderIceBalance = await ice.balanceOf(holder.address);
        expect(await ice.totalSupply()).to.equal(holderIceBalance);

        const holderH2OBalance = await h2o.balanceOf(holder.address);
        expect(await h2o.totalSupply()).to.equal(holderH2OBalance);

    });

    it("Should have only listed admins", async function () {
        const { ice, h2o } = await loadFixture(upgradeFixtureV2);
        
        expect(await ice.getRoleMemberCount(ice.DEFAULT_ADMIN_ROLE())).to.equal(2);
        expect(await h2o.getRoleMemberCount(h2o.DEFAULT_ADMIN_ROLE())).to.equal(2);
    });

    it("Should not set tokens again", async function () {
        const { controller, ice, h2o, iceCube, icePool } = await loadFixture(upgradeFixtureV2);

        await expect(controller.setTokens(ice.address, h2o.address, iceCube.address, icePool.address)).to.be.reverted;
    });

    it("Should claim rewards via controller", async function () {
        const { controller, h2o, holder } = await loadFixture(upgradeFixtureV2);

        const holderH2OBalance = await h2o.balanceOf(holder.address);
        await controller.connect(holder).claimRewards();
        expect(await h2o.balanceOf(holder.address)).to.be.gt(holderH2OBalance);
    });

    it("Should not allow users to claim rewards directly from tokens", async function () {
        const { ice, owner, admin, holder } = await loadFixture(upgradeFixtureV2);

        await expect(ice.connect(owner).claimReward(holder.address)).to.be.reverted;
        await expect(ice.connect(admin).claimReward(holder.address)).to.be.reverted;
        await expect(ice.connect(holder).claimReward(holder.address)).to.be.reverted;
    });

    it("Should swap H2O for Ice in virtual pool", async function () {
        const { controller, ice, h2o, holder } = await loadFixture(upgradeFixtureV2);

        const holderH2O = BigInt(await h2o.balanceOf(holder.address));
        const holderIce = BigInt(await ice.balanceOf(holder.address));
        const previewedSwap = BigInt(await controller.connect(holder).previewSwapH2OForICE(100));
        const timeStamp = BigInt((await ethers.provider.getBlock("latest")).timestamp) + 600n;
        await controller.connect(holder).swapH2OForICE(100, 0, timeStamp);

        expect(await h2o.balanceOf(holder.address)).to.equal(holderH2O - 100n);
        expect(await ice.balanceOf(holder.address)).to.equal(holderIce + previewedSwap);
    });

    it("Should swap Ice for H2O in virtual pool", async function () {
        const { controller, ice, h2o, holder } = await loadFixture(upgradeFixtureV2);

        const holderH2O = BigInt(await h2o.balanceOf(holder.address));
        const holderIce = BigInt(await ice.balanceOf(holder.address));
        const previewedSwap = BigInt(await controller.connect(holder).previewSwapICEForH2O(100));
        const timeStamp = BigInt((await ethers.provider.getBlock("latest")).timestamp) + 600n;
        await controller.connect(holder).swapICEForH2O(100, 0, timeStamp); //@audit Name style

        expect(await h2o.balanceOf(holder.address)).to.equal(holderH2O + previewedSwap);
        expect(await ice.balanceOf(holder.address)).to.equal(holderIce - 100n);
    });

    it("Should not swap when paused and swap when unpaused", async function () {
        const { controller, ice, h2o, admin, holder } = await loadFixture(upgradeFixtureV2);

        await controller.connect(admin).pause(true);
        const timeStamp = BigInt((await ethers.provider.getBlock("latest")).timestamp) + 600n;
        await expect(controller.connect(holder).swapH2OForICE(100, 0, timeStamp)).to.be.reverted;

        await controller.connect(admin).unpause(true);
        const holderH2O = BigInt(await h2o.balanceOf(holder.address));
        const holderIce = BigInt(await ice.balanceOf(holder.address));
        const previewedSwap = BigInt(await controller.connect(holder).previewSwapH2OForICE(100));

        await controller.connect(holder).swapH2OForICE(100, 0, timeStamp);

        expect(await h2o.balanceOf(holder.address)).to.equal(holderH2O - 100n);
        expect(await ice.balanceOf(holder.address)).to.equal(holderIce + previewedSwap);
    });

    it("Should let owner set melt rate", async function () {
        const { controller, admin } = await loadFixture(upgradeFixtureV2);

        await controller.connect(admin).setMeltRate(10);

        expect(await controller.annualMeltRate()).to.equal(10 * 31536000);
    });

    it("Should not let non-owner set melt rate", async function () {
        const { controller, holder } = await loadFixture(upgradeFixtureV2);

        await expect(controller.connect(holder).setMeltRate(10)).to.be.reverted;
    });

    it("Should let owner set error update period", async function () {
        const { controller, admin } = await loadFixture(upgradeFixtureV2);

        await controller.connect(admin).setErrorUpdatePeriod(10);

        //expect(await controller.[no getter function]()).to.equal(10);
    });

    it("Should not let non-owner set melt rate", async function () {
        const { controller, holder } = await loadFixture(upgradeFixtureV2);

        await expect(controller.connect(holder).setErrorUpdatePeriod(10)).to.be.reverted;
    });

});