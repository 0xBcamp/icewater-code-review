/* global BigInt */
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
require('solidity-coverage');

//todo reuse code from here when deploying stuff
const deployUtils = require("../scripts/deployUtils.js");

describe("Upgradeable Tokens test", function () {
    async function deployFixture() {
        const IceToken = await ethers.getContractFactory("IceToken");
        const H2OToken = await ethers.getContractFactory("H2OToken");
        const SteamToken = await ethers.getContractFactory("SteamToken");
        const IceCube = await ethers.getContractFactory("IceCube");

        const [deployer, admin, holder, addr1, addr2] = await ethers.getSigners();

        // The admin accounts of the tokens
        const admins = [admin.address]

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

        // Deploy SteamToken
        const stm = await upgrades.deployProxy(
            SteamToken,
            [admins, holder.address],
            {kind: 'uups'} );

        return { ice, h2o, iceCube, stm, deployer, admin, holder, addr1, addr2 };
    }

    async function upgradeFixtureV2() {
        const { h2o, deployer, admin, holder, addr1, addr2 } =
            await loadFixture(deployFixture);

        // Use the admin as the signer of this contract so that the admin is
        // used when upgrading.
        const MockH2OToken_v2 = await ethers.getContractFactory(
            "MockH2OToken_v2", signer=admin);

        // Upgrade from H2OToken to MockH2OToken_v2
        const h2o_v2 = await upgrades.upgradeProxy(
            h2o.address,
            MockH2OToken_v2,
            {kind: 'uups'} );

        await h2o_v2.deployed();

        // todo try not calling upgrade.
        // todo try running with non-admin signer
        await h2o_v2.upgrade();

        return { h2o_v2, deployer, admin, holder, addr1, addr2 };
    }

    async function upgradeFixtureV3() {
        const { h2o_v2, deployer, admin, holder, addr1, addr2 } =
            await await loadFixture(upgradeFixtureV2);;

        // Use the admin as the signer of this contract so that the admin is
        // used when upgrading.
        const MockH2OToken_v3 = await ethers.getContractFactory(
            "MockH2OToken_v3", signer=admin);

        // Upgrade from H2OToken to MockH2OToken_v4
        const h2o_v3 = await upgrades.upgradeProxy(
            h2o_v2.address,
            MockH2OToken_v3,
            {kind: 'uups'} );

        await h2o_v3.deployed();

        // todo try not calling upgrade.
        // todo try running with non-admin signer
        await h2o_v3.upgrade();

        return { h2o_v3, deployer, admin, holder, addr1, addr2 };
    }
    
    // todo check if these are indeed proxies
    it("Should deploy tokens to holder", async function () {
        const { ice, h2o, stm, holder } = await loadFixture(deployFixture);

        const holderIceBalance = await ice.balanceOf(holder.address);
        expect(await ice.totalSupply()).to.equal(holderIceBalance);

        const holderH2OBalance = await h2o.balanceOf(holder.address);
        expect(await h2o.totalSupply()).to.equal(holderH2OBalance);

        const holderSteamBalance = await stm.balanceOf(holder.address);
        expect(await stm.totalSupply()).to.equal(holderSteamBalance);
    });


    it("Should upgrade H2O to V2", async function () {
        const { h2o_v2, holder } = await loadFixture(upgradeFixtureV2);

        const holderH2OBalance = await h2o_v2.balanceOf(holder.address);
        expect(await h2o_v2.totalSupply()).to.equal(holderH2OBalance);

        // Make sure the newly upgraded contract has the new newVar1 and newVar2
        expect(await h2o_v2.newVar1()).to.equal(1);
        expect(await h2o_v2.newVar2()).to.equal(2);
    });

    it("Should upgrade H2O to V3", async function () {
        const { h2o_v3 } = await loadFixture(upgradeFixtureV3);

        // Make sure the newly upgraded contract has the new newVar1 and newVar2
        expect(await h2o_v3.newVar1()).to.equal(1);
        expect(await h2o_v3.newVar2()).to.equal(2);
        expect(await h2o_v3.newMintableBurnableVar()).to.equal(3);
    });

    it("Should fail upgrading H2O to V4", async function () {
        // Start by upgrading to v2.
        const { h2o_v2, admin } = await loadFixture(upgradeFixtureV2);

        // Upgrade v2 to v4. V4 adds a member to one of the base contracts,
        // which should trump the members added in V2. This upgrade shouold
        // fail.
        // Use the admin as the signer of this contract so that the admin is
        // used when upgrading.
        const MockH2OToken_v4 = await ethers.getContractFactory(
            "MockH2OToken_v4", signer=admin);

        // Upgrade from H2OToken to MockH2OToken_v4
        var h2o_v4;
        try {
            h2o_v4 = await upgrades.upgradeProxy(
                h2o_v2.address, MockH2OToken_v4, {kind: 'uups'}) 
        } catch(err) {
            expect(err.message).includes("New storage layout is incompatible");
        }

        expect(h2o_v4).to.be.undefined;

    });

    

});