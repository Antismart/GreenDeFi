const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();

    console.log("Deploying contracts with the account:", deployer.address);

   // Define the parameters for the contract deployment
    const ORACLE_ADDRESS = "0xd36c6B1777c7f3Db1B3201bDD87081A9045B7b46";  // Replace with your Oracle address
    const JOB_ID = "a8356f48569c434eaa4ac5fcb4db5cc0";                    // Replace with your Job ID
    const FEE = ethers.utils.parseEther("0.1");    // Fee in LINK tokens
    const LINK_TOKEN_ADDRESS = "0xf97f4df75117a78c1A5a0DBb814Af92458539FB4";  // Replace with LINK token address
    const PRICE_FEED_ADDRESS = "0x3ec8593F930EA45ea58c968260e6e9FF53FC934f";  // Replace with price feed address
  
    const GreenDeFiProtocol = await hre.ethers.getContractFactory("GreenDeFiProtocol");
    const greenDeFiProtocol = await GreenDeFiProtocol.deploy(
        ORACLE_ADDRESS,
        JOB_ID,
        FEE,
        LINK_TOKEN_ADDRESS,
        PRICE_FEED_ADDRESS
    );

    await greenDeFiProtocol.deployed();

    console.log("GreenDeFiProtocol deployed to:", greenDeFiProtocol.address);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });