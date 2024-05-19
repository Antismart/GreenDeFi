import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import GreenDeFiProtocol from './contracts/GreenDeFiProtocol.json';

function App() {
  const [contract, setContract] = useState(null);
  const [account, setAccount] = useState('');
  const [projectCount, setProjectCount] = useState(0);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    projectName: '',
    targetAmount: '',
    milestoneAmounts: '',
    milestoneData: '',
  });

  useEffect(() => {
    const init = async () => {
      await loadBlockchainData();
    };
    init();
  }, []);

  const loadBlockchainData = async () => {
    try {
      // Connect to the Arbitrum testnet
      const provider = new ethers.providers.JsonRpcProvider('https://rinkeby.arbitrum.io/rpc');
      const signer = provider.getSigner();
      const contractAddress = 'YOUR_CONTRACT_ADDRESS'; // Replace with your contract address
      const contractAbi = GreenDeFiProtocol.abi;
      const contract = new ethers.Contract(contractAddress, contractAbi, signer);

      // Get the connected account address
      const accounts = await provider.listAccounts();
      const account = accounts[0];
      setAccount(account);

      // Get the total project count
      const projectCount = await contract.projectCount();
      setProjectCount(projectCount.toNumber());

      // Fetch project details
      const projects = [];
      for (let i = 1; i <= projectCount; i++) {
        const project = await contract.getProject(i);
        projects.push(project);
      }
      setProjects(projects);

      setContract(contract);
    } catch (error) {
      console.error('Error loading blockchain data:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');

      // Call smart contract function to create a new project
      await contract.createProject(
        formData.projectName,
        ethers.utils.parseEther(formData.targetAmount),
        formData.milestoneAmounts.split(',').map((amount) => ethers.utils.parseEther(amount.trim())),
        formData.milestoneData.split(',')
      );

      // Refresh project list
      await loadBlockchainData();
    } catch (error) {
      setError('Error creating project: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-100 min-h-screen py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-semibold mb-4">Green DeFi Protocol</h1>
        <div className="mb-8">
          <p className="text-lg font-medium">Connected Account:</p>
          <p className="text-gray-600">{account}</p>
        </div>
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Create New Project</h2>
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="projectName" className="block text-gray-700 font-medium">Project Name</label>
              <input
                type="text"
                id="projectName"
                className="mt-1 p-2 w-full border-gray-300 rounded-md focus:outline-none focus:ring focus:ring-blue-200"
                value={formData.projectName}
                onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                required
              />
            </div>
            <div className="mb-4">
              <label htmlFor="targetAmount" className="block text-gray-700 font-medium">Target Amount (ETH)</label>
              <input
                type="number"
                id="targetAmount"
                className="mt-1 p-2 w-full border-gray-300 rounded-md focus:outline-none focus:ring focus:ring-blue-200"
                value={formData.targetAmount}
                onChange={(e) => setFormData({ ...formData, targetAmount: e.target.value })}
                required
              />
            </div>
            <div className="mb-4">
              <label htmlFor="milestoneAmounts" className="block text-gray-700 font-medium">Milestone Amounts (ETH)</label>
              <input
                type="text"
                id="milestoneAmounts"
                className="mt-1 p-2 w-full border-gray-300 rounded-md                focus:outline-none focus:ring focus:ring-blue-200"
                value={formData.milestoneAmounts}
                onChange={(e) => setFormData({ ...formData, milestoneAmounts: e.target.value })}
                required
              />
              <p className="text-sm text-gray-500">Separate milestone amounts with commas (e.g., 10, 20, 30)</p>
            </div>
            <div className="mb-4">
              <label htmlFor="milestoneData" className="block text-gray-700 font-medium">Milestone Data</label>
              <textarea
                id="milestoneData"
                rows="3"
                className="mt-1 p-2 w-full border-gray-300 rounded-md focus:outline-none focus:ring focus:ring-blue-200"
                value={formData.milestoneData}
                onChange={(e) => setFormData({ ...formData, milestoneData: e.target.value })}
                required
              />
              <p className="text-sm text-gray-500">Enter milestone data separated by new lines</p>
            </div>
            {error && <p className="text-red-600 mb-2">{error}</p>}
            <button
              type="submit"
              className="bg-blue-500 text-white font-medium py-2 px-4 rounded-md focus:outline-none focus:ring focus:ring-blue-200"
              disabled={loading}
            >
              {loading ? 'Creating Project...' : 'Create Project'}
            </button>
          </form>
        </div>
        <div>
          <h2 className="text-xl font-semibold mb-2">Projects:</h2>
          <div>
            {projects.map((project, index) => (
              <div key={index} className="bg-white rounded-md shadow-md p-4 mb-4">
                <p className="text-lg font-semibold mb-2">{project[0]}</p>
                <p className="text-gray-600">Target Amount: {ethers.utils.formatEther(project[1])} ETH</p>
                <p className="text-gray-600">Current Amount: {ethers.utils.formatEther(project[2])} ETH</p>
                <p className="text-gray-600">Creator: {project[3]}</p>
                <p className="text-gray-600">Funded: {project[4] ? 'Yes' : 'No'}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;

