import * as _ from 'lodash';
import { ethers } from 'ethers';
import { createInterface } from 'readline';

const { abi } = require('../build/contracts/KERC20.json');


// ------------[ Configuration - Begin ]------------
const network:    string = process.env.CHAIN || "goerli";
const address:    string = process.env.PROXY || "erlc.iexec.eth";
const privatekey: string = process.env.MNEMONIC1;
// ------------[  Configuration - End  ]------------



// RLC: 0xe0d00540a3729B4fdB96f92534dA97DC7973Af8b
// ERLC: 0x739ce64780Ec594e7547338764cB22266d7dcd77
// WALLET: 0xF037353a9B47f453d89E9163F21a2f6e1000B07d

(async () => {
	let provider: ethers.providers.Provider = ethers.getDefaultProvider(network);
	let wallet:   ethers.Wallet             = new ethers.Wallet(privatekey, provider);
	let contract: ethers.Contract           = new ethers.Contract(address, abi, wallet);
	let entries:  string[]                  = [];

	createInterface({
		input: process.stdin,
		output: process.stdout,
		terminal: false
	})
	.on('line', (entry) => {
		entries.push(entry);
	})
	.on('close', () => {
		_.chunk(entries, 32).reduce(
			(promise, chunk) => new Promise((resolve, reject) => {
				Promise.resolve(promise)
				.then(() => {
					console.log({ chunk })
					contract.grantKYC(chunk)
					.then(({ wait }) => wait().then(resolve).catch(reject))
					.catch(reject)
				})
				.catch(reject);
			}),
			null
		).then(() => console.log(`Processed ${entries.length} addresses`));
	});

})().catch(console.error);
