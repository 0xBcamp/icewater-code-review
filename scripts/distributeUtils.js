const dotenv = require("dotenv");
const dotenvExpand = require("dotenv-expand");

function toDecimalBigInt(x) {
    const zeros18 = BigInt("1000000000000000000");
    return BigInt(Math.floor(x * 1000000)) * zeros18 / BigInt(1000000);
}

async function distribute(holder, IceToken, H2OToken, Distribution) {
    if(process.env.DISTRIBUTION_FIXED) {
        return distributeFixedAmounts(holder, IceToken, H2OToken, Distribution);
    } else {
        return distributeAmounts(holder, IceToken, H2OToken, Distribution);
    }
}

async function distributeAmounts(holder, IceToken, H2OToken, Distribution) {
    // Load the .env file
    var dotenvConfig = dotenv.config()
    dotenvExpand.expand(dotenvConfig)

    let toAddrs = process.env.DISTRIBUTION_ADDRESSES;
    if (!toAddrs) {
        console.error("Missing DISTRIBUTION_ADDRESSES");
    }
    toAddrs = toAddrs.split(',');

    let iceAmounts = process.env.DISTRIBUTION_ICE_AMOUNTS;
    var doDistIce = true;
    if (!iceAmounts) {
        console.log("Missing DISTRIBUTION_ICE_AMOUNTS");
        doDistIce = false;
        iceAmounts = [];
    } else {
        iceAmounts = iceAmounts.split(',');
    }
    

    if (doDistIce && iceAmounts.length != toAddrs.length) {
        console.error("Distribution ICE amounts don't match number of addresses." +
                      " Set DISTRIBUTION_ICE_AMOUNTS.");
        return;
    }

    let h2oAmounts = process.env.DISTRIBUTION_H2O_AMOUNTS;
    var doDistH2O = true;
    if (!h2oAmounts) {
        console.error("Missing DISTRIBUTION_H2O_AMOUNTS");
        doDistH2O = false;
        h2oAmounts = [];
    } else {
        h2oAmounts = h2oAmounts.split(',');
    }    

    if (doDistH2O && h2oAmounts.length != toAddrs.length) {
        console.error("Distribution H2O amounts don't match number of addresses." +
                      " Set DISTRIBUTION_H2O_AMOUNTS.");
        return;
    }

    if (!doDistIce && !doDistH2O) {
        console.error("Nothing to Distribute");
        return;
    }

    // Supplies
    const iceSupply = await IceToken.balanceOf(holder.address);
    const h2oSupply = await H2OToken.balanceOf(holder.address);

    console.log("Supplies in the Holder", holder.address, ":");
    console.log("  ICE: " + iceSupply);
    console.log("  H2O: " + h2oSupply);

    // Get the distribution amounts
    var dIceAmounts = [];
    var dH2OAmounts = [];

    var iceTotalAmount = 0;
    var h2oTotalAmount = 0;

    for (var i =0; i < toAddrs.length; i++) {
        if (doDistIce) {
            iceTotalAmount += parseFloat(iceAmounts[i]);
            dIceAmounts[i] = toDecimalBigInt(iceAmounts[i]);
        }

        if (doDistH2O) {
            h2oTotalAmount += parseFloat(h2oAmounts[i]);
            dH2OAmounts[i] = toDecimalBigInt(h2oAmounts[i]);
        }
    }

    const dIceTotalAmount = toDecimalBigInt(iceTotalAmount);
    const dH2OTotalAmount = toDecimalBigInt(h2oTotalAmount);
    

    // Approve
    console.log("Approve Amounts:");
    console.log("  ICE: " + iceTotalAmount);
    console.log("  H2O: " + h2oTotalAmount);

    if (doDistIce && iceTotalAmount > 0) {
        if (dIceTotalAmount > iceSupply) {
            throw('Not enough Ice Supply.');
        }

        const tx = await IceToken.connect(holder).approve(Distribution.address, dIceTotalAmount);
        const receipt = await tx.wait();
        if (receipt.status !== 1) {
            throw('Error in transaction when approving Ice.');
        }
        console.log("   done.");
    }

    if (doDistH2O && h2oTotalAmount > 0) {
        if (dH2OTotalAmount > h2oSupply) {
            throw('Not enough H2O Supply.');
        }

        const tx = await H2OToken.connect(holder).approve(Distribution.address, dH2OTotalAmount);
        const receipt = await tx.wait();
        if (receipt.status !== 1) {
            throw('Error in transaction when approving H2O.');
        }
        console.log("   done.");
    }

    // Distribute
    console.log("Dist Total Amounts:");
    console.log("  ICE: " + iceTotalAmount);
    console.log("  H2O: " + h2oTotalAmount);

    if (doDistIce && iceTotalAmount > 0) {

        console.log("Distributing ICE", dIceTotalAmount.toString());
        const tx = await Distribution.connect(holder).distributeAmounts(
            IceToken.address, toAddrs, dIceAmounts);
        const receipt = await tx.wait();
        if (receipt.status !== 1) {
            throw('Error in transaction when distributing Ice.');
        }
        console.log("   done.");
    }

    if (doDistH2O && h2oTotalAmount > 0) {
        console.log("Distributing H2O", dH2OTotalAmount.toString());
        const tx = await Distribution.connect(holder).distributeAmounts(
            H2OToken.address, toAddrs, dH2OAmounts)
        const receipt = await tx.wait();
        if (receipt.status !== 1) {
            throw('Error in transaction when distributing H2O.');
        }
        console.log("   done.");
    }

    // Final Balances
    const iceBalance = await IceToken.balanceOf(toAddrs[0]);
    const h2oBalance = await H2OToken.balanceOf(toAddrs[0]);

    console.log("Final Balances per account:");
    console.log("  ICE: " + iceBalance);
    console.log("  H2O: " + h2oBalance);

}

module.exports = {
    distribute
}


async function distributeFixedAmounts(holder, IceToken, H2OToken, Distribution) {
    // Load the .env file
    var dotenvConfig = dotenv.config()
    dotenvExpand.expand(dotenvConfig)

    let toAddrs = process.env.DISTRIBUTION_ADDRESSES;
    if (!toAddrs) {
        console.error("Missing DISTRIBUTION_ADDRESSES");
    }
    toAddrs = toAddrs.split(',');

    const distAmoutIce=process.env.DISTRIBUTION_AMOUNT_ICE
    const distAmoutH2O=process.env.DISTRIBUTION_AMOUNT_H2O

    const doDistIce = parseInt(distAmoutIce) > 0;
    const doDistH2O = parseInt(distAmoutH2O) > 0;

    if (!doDistH2O && !doDistH2O) {
        console.error("No distribution amounts." +
                      " Set DISTRIBUTION_AMOUNT_ICE / DISTRIBUTION_AMOUNT_H2O");
        return;
    }

    // Supplies
    const iceSupply = await IceToken.balanceOf(holder.address);
    const h2oSupply = await H2OToken.balanceOf(holder.address);

    console.log("Supplies:");
    console.log("  ICE: " + iceSupply);
    console.log("  H2O: " + h2oSupply);

    // Get the distribution amounts
    const zeros18 = BigInt("1000000000000000000");
    const iceDistAmount = BigInt(distAmoutIce) * zeros18;
    const h2oDistAmount = BigInt(distAmoutH2O) * zeros18;
    
    const numAddresses = BigInt(toAddrs.length);
    const iceApproveAmount = iceDistAmount * numAddresses;
    const h2oApproveAmount = h2oDistAmount * numAddresses;
    
    // Approve
    console.log("Approve Amounts:");
    console.log("  ICE: " + iceApproveAmount);
    console.log("  H2O: " + h2oApproveAmount);

    if (doDistIce) {
        const tx = await IceToken.connect(holder).approve(Distribution.address, iceApproveAmount);
        const receipt = await tx.wait();
        console.log("Approved ICE", iceApproveAmount.toString());
    }

    if (doDistH2O) {
        const tx = await H2OToken.connect(holder).approve(Distribution.address, h2oApproveAmount);
        const receipt = await tx.wait();
        console.log("Approved H2O", h2oApproveAmount.toString());
    }


    // Distribute
    console.log("Dist Amounts:");
    console.log("  ICE: " + iceDistAmount);
    console.log("  H2O: " + h2oDistAmount);

    if (doDistIce) {
        console.log("Distributing ICE", iceDistAmount.toString());
        const tx = await Distribution.connect(holder).distributeAmount(
            IceToken.address, toAddrs, iceDistAmount);
        await tx.wait();
        console.log("   done.");
    }

    if (doDistH2O) {
        console.log("Distributing H2O", h2oDistAmount.toString());
        const tx = await Distribution.connect(holder).distributeAmount(
            H2OToken.address, toAddrs, h2oDistAmount)
        await tx.wait();
        console.log("   done.");
    }

    // Final Balances
    const iceBalance = await IceToken.balanceOf(toAddrs[0]);
    const h2oBalance = await H2OToken.balanceOf(toAddrs[0]);

    console.log("Final Balances per account:");
    console.log("  ICE: " + iceBalance);
    console.log("  H2O: " + h2oBalance);

}

module.exports = {
    distribute,
    distributeAmounts,
    distributeFixedAmounts
}