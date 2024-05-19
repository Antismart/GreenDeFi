// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@chainlink/contracts/src/v0.8/ChainlinkClient.sol";
import "@chainlink/contracts/src/v0.8/Chainlink.sol";

contract GreenDeFiProtocol is AccessControl, ERC20, ChainlinkClient {
    using Chainlink for Chainlink.Request;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    event ProjectCreated(uint256 projectId, string name, uint256 targetAmount, address creator);
    event MilestoneFunded(uint256 projectId, uint256 milestoneId, uint256 amount, address funder);
    event MilestoneVerified(uint256 projectId, uint256 milestoneId, bool achieved);
    event CarbonCreditIssued(uint256 creditId, uint256 amount, address issuer);
    event CarbonCreditTransferred(uint256 creditId, address from, address to);
    event RewardIssued(address user, uint256 amount);

    struct Project {
        string name;
        uint256 targetAmount;
        uint256 currentAmount;
        address payable creator;
        bool funded;
        Milestone[] milestones;
    }

    struct Milestone {
        uint256 amount;
        bool achieved;
        string data;
    }

    struct CarbonCredit {
        uint256 amount;
        address issuer;
        address owner;
    }

    uint256 public projectCount;
    uint256 public creditCount;
    mapping(uint256 => Project) public projects;
    mapping(uint256 => CarbonCredit) public carbonCredits;
    mapping(address => uint256) public rewards;
    AggregatorV3Interface internal priceFeed;

    address private oracle;
    bytes32 private jobId;
    uint256 private fee;

    constructor(address _oracle, string memory _jobId, uint256 _fee, address _link, address _priceFeed) ERC20("GreenDeFiToken", "GDT") {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ADMIN_ROLE, msg.sender);

        setChainlinkToken(_link);
        oracle = _oracle;
        jobId = stringToBytes32(_jobId);
        fee = _fee;
        priceFeed = AggregatorV3Interface(_priceFeed);
    }

    function createProject(string memory name, uint256 targetAmount, uint256[] memory milestoneAmounts, string[] memory milestoneData) public {
        require(hasRole(ADMIN_ROLE, msg.sender), "Caller is not an admin");
        require(milestoneAmounts.length == milestoneData.length, "Milestone data length mismatch");

        projectCount++;
        Project storage project = projects[projectCount];
        project.name = name;
        project.targetAmount = targetAmount;
        project.creator = payable(msg.sender);
        project.funded = false;

        for (uint256 i = 0; i < milestoneAmounts.length; i++) {
            project.milestones.push(Milestone({
                amount: milestoneAmounts[i],
                achieved: false,
                data: milestoneData[i]
            }));
        }

        emit ProjectCreated(projectCount, name, targetAmount, msg.sender);
    }

    function fundMilestone(uint256 projectId, uint256 milestoneId) public payable {
        Project storage project = projects[projectId];
        require(project.creator != address(0), "Project does not exist");
        require(milestoneId < project.milestones.length, "Invalid milestone ID");
        require(!project.milestones[milestoneId].achieved, "Milestone already achieved");
        require(msg.value == project.milestones[milestoneId].amount, "Incorrect funding amount");

        project.currentAmount += msg.value;
        requestMilestoneVerification(projectId, milestoneId, project.milestones[milestoneId].data);

        emit MilestoneFunded(projectId, milestoneId, msg.value, msg.sender);
    }

    function requestMilestoneVerification(uint256 projectId, uint256 milestoneId, string memory data) internal {
        Chainlink.Request memory request = buildChainlinkRequest(jobId, address(this), this.fulfillMilestoneVerification.selector);
        request.add("get", data);
        request.add("path", "achieved");

        request.addUint("projectId", projectId);
        request.addUint("milestoneId", milestoneId);

        sendChainlinkRequestTo(oracle, request, fee);
    }

    function fulfillMilestoneVerification(bytes32 _requestId, bool _achieved, uint256 projectId, uint256 milestoneId) public recordChainlinkFulfillment(_requestId) {
        Project storage project = projects[projectId];
        Milestone storage milestone = project.milestones[milestoneId];
        require(!milestone.achieved, "Milestone already achieved");

        if (_achieved) {
            milestone.achieved = true;
            project.funded = (project.currentAmount >= project.targetAmount);
        }

        emit MilestoneVerified(projectId, milestoneId, _achieved);
    }

    function issueCarbonCredit(uint256 amount, address to) public {
        require(hasRole(ISSUER_ROLE, msg.sender), "Caller is not an issuer");

        creditCount++;
        carbonCredits[creditCount] = CarbonCredit({
            amount: amount,
            issuer: msg.sender,
            owner: to
        });

        emit CarbonCreditIssued(creditCount, amount, msg.sender);
    }

    function transferCarbonCredit(uint256 creditId, address to) public {
        CarbonCredit storage credit = carbonCredits[creditId];
        require(credit.owner == msg.sender, "Caller is not the owner");

        credit.owner = to;
        emit CarbonCreditTransferred(creditId, msg.sender, to);
    }

    function issueReward(address user, uint256 amount) public {
        require(hasRole(ADMIN_ROLE, msg.sender), "Caller is not an admin");

        rewards[user] += amount;
        _mint(user, amount);

        emit RewardIssued(user, amount);
    }

    function withdrawRewards() public {
        uint256 reward = rewards[msg.sender];
        require(reward > 0, "No rewards available");

        rewards[msg.sender] = 0;
        _burn(msg.sender, reward);

        payable(msg.sender).transfer(reward);
    }

    function getProject(uint256 projectId) public view returns (string memory, uint256, uint256, address, bool, Milestone[] memory) {
        Project storage project = projects[projectId];
        return (project.name, project.targetAmount, project.currentAmount, project.creator, project.funded, project.milestones);
    }

    function getCarbonCredit(uint256 creditId) public view returns (uint256, address, address) {
        CarbonCredit storage credit = carbonCredits[creditId];
        return (credit.amount, credit.issuer, credit.owner);
    }

    function getUserRewards(address user) public view returns (uint256) {
        return rewards[user];
    }

    function getLatestPrice() public view returns (int) {
        (,int price,,,) = priceFeed.latestRoundData();
        return price;
    }

    function stringToBytes32(string memory source) internal pure returns (bytes32 result) {
        bytes memory tempEmptyStringTest = bytes(source);
        if (tempEmptyStringTest.length == 0) {
            return 0x0;
        }

        assembly {
            result := mload(add(source, 32))
        }
    }
}
