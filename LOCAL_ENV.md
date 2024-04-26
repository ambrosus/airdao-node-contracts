1. **Install Node.js and npm**: Node.js is a JavaScript runtime that is required for your project. npm (Node Package Manager) is a package manager for Node.js. You can download and install Node.js and npm from [here](https://nodejs.org/en/download/).

2. **Clone the project**: Clone the project from GitHub to your local machine using the following command in your terminal:

```bash
git clone https://github.com/ambrosus/airdao-node-contracts.git
```

3. **Navigate to the project directory**: Use the following command to navigate into the project directory:

```bash
cd airdao-node-contracts
```

4. **Install project dependencies**: Your project dependencies are listed in your `package.json` file. You can install these dependencies using either npm or Yarn. Run one of the following commands in your terminal:

```bash
npm install
```

5. **Create a .env file**: Your project uses environment variables which are stored in a `.env` file. You'll need to create this file in your project root. Refer to the `.example.env` file in your project for what environment variables are needed.

6. **Set up Hardhat**: Hardhat is a development environment to compile, deploy, test, and debug your Ethereum software. It's already listed as a devDependency in your package.json, so it should be installed when you ran npm install or yarn install. You can check if it's installed by running

```bash
npm install --global hardhat
```

7.  **Build the project**: You can build the project using either npm or Yarn. Run one of the following commands in your terminal:

    ```bash
    npm run build
    ```

8.  **Run tests**: You can run tests using either npm or Yarn. Run one of the following commands in your terminal:

Using npm:

```bash
npm run test
```

Using Yarn:

```bash
yarn test
```

9. **Check tests coverage**: You can check tests coverage using either npm or Yarn. Run one of the following commands in your terminal:

Using npm:

```bash
npm run coverage
```

Using Yarn:

```bash
yarn coverage
```

10. **Deploy contracts**: You can deploy contracts using either npm or Yarn. Run one of the following commands in your terminal:

Using npm:

```bash
npm run deploy:all
```

Using Yarn:

```bash
yarn deploy:all
```

***You also can deploy contracts separately by running deploy scripts from package.json***

***
You also can change network for deploy. It can be changed in package,json scripts. `--network` parameter can be changed to: 
- hardhat
- local
- dev
- test
- main 

Settings for this environments you can find at `hardhat.config.ts` file.
***


Your project should now be running locally.

Please note that these instructions are quite general and may need to be adjusted based on the specifics of your project.
