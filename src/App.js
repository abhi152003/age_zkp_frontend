import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { groth16 } from "snarkjs";

const DebugAgeVerifier = () => {
  const [birthdate, setBirthdate] = useState("");
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [debugInfo, setDebugInfo] = useState({});
  const [contract, setContract] = useState(null);
  const [signer, setSigner] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const CONTRACT_ADDRESS = "0x93CdA6c5648321e9041c359401fCaa8B158E081E";
  const CONTRACT_ABI = [
    {
      "inputs": [
        {
          "internalType": "uint256[2]",
          "name": "_pA",
          "type": "uint256[2]"
        },
        {
          "internalType": "uint256[2][2]",
          "name": "_pB",
          "type": "uint256[2][2]"
        },
        {
          "internalType": "uint256[2]",
          "name": "_pC",
          "type": "uint256[2]"
        },
        {
          "internalType": "uint256[1]",
          "name": "_pubSignals",
          "type": "uint256[1]"
        }
      ],
      "name": "verifyProof",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    }
  ];

  useEffect(() => {
    loadContract();
  }, []);

  const loadContract = async () => {
    try {
      setError(null);
      if (!window.ethereum) {
        throw new Error("Please install MetaMask to use this application");
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const newSigner = await provider.getSigner();
      setSigner(newSigner);

      const contractInstance = new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        newSigner
      );
      setContract(contractInstance);
    } catch (err) {
      setError(err.message);
      console.error("Contract loading error:", err);
    }
  };

  const handleVerify = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!contract || !signer) {
        throw new Error("Contract or signer not initialized");
      }

      // Parse the birthdate input
      const birthdateTimestamp = Math.floor(new Date(birthdate).getTime() / 1000);
      const currentDateTimestamp = Math.floor(Date.now() / 1000);

      // Calculate user's age in years
      const ageInYears = Math.floor(
        (currentDateTimestamp - birthdateTimestamp) / (365 * 24 * 60 * 60)
      );

      // Set the minimum age threshold (e.g., 18)
      const minAge = 18;

      // Debug info
      setDebugInfo({
        birthdateTimestamp,
        currentDateTimestamp,
        ageInYears,
        minAge,
      });

      console.log("Inputs for generating a proof: ", minAge, birthdateTimestamp, currentDateTimestamp)

      // Generate the proof
      const { proof, publicSignals } = await groth16.fullProve(
        {
          minAge,
          birthdate: birthdateTimestamp,
          currentDate: currentDateTimestamp
        },
        "/birthdate_age.wasm",
        "/birthdate_age_final.zkey"
      );

      console.log("Public Signals", publicSignals);
      console.log("Proof", proof)

      // Check if publicSignals contains "1"
      const isVerified = publicSignals.includes("1");

      // Export calldata for the contract
      const calldata = await groth16.exportSolidityCallData(proof, publicSignals);
      console.log("Call data", calldata)
      const args = JSON.parse(`[${calldata}]`);

      // console.log(args[0], args[1], args[2], args[3]);

      // Call the contract's view function
      const result = await contract.verifyProof(args[0], args[1], args[2], args[3]);

      console.log("Contract verification result:", result);

      // Semantic validation: combine contract verification with publicSignals check
      const isAbove18 = result && isVerified;

      setDebugInfo((prevInfo) => ({
        ...prevInfo,
        proof,
        publicSignals,
        contractResult: result,
        isAbove18,
      }));

      // Set more descriptive verification status
      setVerificationStatus(
        isAbove18
          ? "Verified: User is above 18"
          : "Not Verified: User is under 18 or proof validation failed"
      );
    } catch (err) {
      setError(err.message);
      console.error("Verification error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto bg-white rounded-xl shadow-md">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Age Verifier</h1>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Birth Date
          </label>
          <input
            type="date"
            onChange={(e) => setBirthdate(e.target.value)}
            value={birthdate}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          onClick={handleVerify}
          disabled={loading || !birthdate}
          className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Verifying..." : "Verify Age"}
        </button>

        {error && (
          <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
            {error}
          </div>
        )}

        {verificationStatus && !error && (
          <div className={`p-3 rounded-md ${verificationStatus.includes("Verified")
            ? "bg-green-100 border border-green-400 text-green-700"
            : "bg-red-100 border border-red-400 text-red-700"
            }`}>
            {verificationStatus}
          </div>
        )}
        {Object.keys(debugInfo).length > 0 && (
          <div className="mt-6 p-4 bg-gray-50 rounded-md">
            <h2 className="text-lg font-semibold mb-3">Information:</h2>
            <div className="space-y-2 font-mono text-sm">
              <p>Birthdate Timestamp: {debugInfo.birthdateTimestamp}</p>
              <p>Current Date Timestamp: {debugInfo.currentDateTimestamp}</p>
              <p>User Age: {debugInfo.ageInYears} years</p>
              <p>Minimum Age Requirement: {debugInfo.minAge} years</p>
              <p>Contract Verification Result: {debugInfo.contractResult ? "True" : "False"}</p>
              <p>Is User Above 18 based on output signal: {debugInfo.isAbove18 ? "Yes" : "No"}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DebugAgeVerifier;
