"use client";

import { useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";

export default function Home() {
  const { connect, disconnect, connected, account, wallets, signMessage } =
    useWallet();

  const [result, setResult] = useState("");

  async function uploadDataset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!connected) {
      setResult("Connect wallet first");
      return;
    }

    const formData = new FormData(e.currentTarget);
    formData.append("ownerWallet", account?.address?.toString() || "");

    try {
      setResult("Please sign message...");

      await signMessage({
        message: "Verify dataset ownership",
        nonce: Date.now().toString(),
      });

      setResult("Uploading dataset...");

      const res = await fetch("http://localhost:4000/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      setResult(`
Dataset Uploaded Successfully

Owner Wallet
${account?.address?.toString()}

Dataset ID
${data.datasetId}

Passport
${data.passportUrl}
      `);
    } catch (err) {
      setResult("Signature cancelled");
    }
  }

  async function verifyDataset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);

    try {
      setResult("Checking dataset...");

      const res = await fetch("http://localhost:4000/verify", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.verified) {
        setResult(`
Dataset Verified

Dataset Name
${data.datasetName}

Passport
${data.passportUrl}
        `);
      } else {
        setResult("Dataset not found");
      }
    } catch (err) {
      setResult("Verification failed");
    }
  }

  return (
    <div className="hero">
      <div className="container">
        <div className="topbar">
          <div className="brand">
            <div className="brand-mark"></div>

            <div className="brand-copy">
              <h1>Dataset Passport</h1>
              <p>Independent dataset provenance app powered by Shelby</p>
            </div>
          </div>

          <div>
            {connected ? (
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => disconnect()}
              >
                Disconnect Wallet
              </button>
            ) : (
              <div className="wallet-buttons">
                {wallets.map((wallet) => (
                  <button
                    key={wallet.name}
                    className="btn btn-primary"
                    type="button"
                    onClick={() => connect(wallet.name)}
                  >
                    Connect {wallet.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="hero-panel glass">
          <div className="hero-main">
            <h2>Publish AI datasets with verifiable provenance</h2>

            <p>
              Upload datasets, sign with your wallet, and generate a dataset
              passport using Shelby as the storage layer.
            </p>

            <div className="hero-actions">
              <a
                className="btn btn-primary"
                href="http://localhost:4000/datasets"
                target="_blank"
                rel="noreferrer"
              >
                View Dataset Registry
              </a>

              <a className="btn btn-secondary" href="#verify-section">
                Verify Dataset
              </a>
            </div>

            {connected && (
              <p style={{ marginTop: "16px", color: "#ffb347" }}>
                Connected wallet: {account?.address?.toString()}
              </p>
            )}
          </div>

          <div className="hero-side">
            <div className="status-card">
              <h3>Upload Dataset</h3>

              <form onSubmit={uploadDataset}>
                <div className="field">
                  <label>Dataset Name</label>
                  <input
                    name="datasetName"
                    placeholder="Dataset Name"
                    required
                  />
                </div>

                <div className="field">
                  <label>Description</label>
                  <textarea
                    name="description"
                    placeholder="Description"
                  ></textarea>
                </div>

                <div className="field">
                  <label>Dataset File</label>
                  <input className="file-input" type="file" name="file" required />
                </div>

                <button className="btn btn-primary" type="submit">
                  Sign & Upload Dataset
                </button>
              </form>
            </div>
          </div>
        </div>

        <div className="result-shell">
          <div className="result-head">Result</div>
          <pre>{result}</pre>
        </div>

        <div
          id="verify-section"
          className="hero-panel glass"
          style={{ marginTop: "24px" }}
        >
          <div className="hero-main">
            <h2>Verify Dataset</h2>

            <p>
              Upload a file to check whether it already exists in your dataset
              registry.
            </p>
          </div>

          <div className="hero-side">
            <div className="status-card">
              <h3>Verify Dataset</h3>

              <form onSubmit={verifyDataset}>
                <div className="field">
                  <label>Dataset File</label>
                  <input className="file-input" type="file" name="file" required />
                </div>

                <button className="btn btn-secondary" type="submit">
                  Verify Dataset
                </button>
              </form>
            </div>
          </div>
        </div>

        <p className="footer-note">
          Dataset Passport is an independent interface. Shelby is used as the
          storage layer underneath.
        </p>
      </div>
    </div>
  );
}