import * as _ from 'lodash';
import { ethers } from 'ethers';
import { createInterface } from 'readline';

const { abi } = require('../build/contracts/KERC20.json');


// ------------[ Configuration - Begin ]------------
const network:    string = process.env.CHAIN || "goerli";
const address:    string = process.env.PROXY || "erlc.iexec.eth";
const privatekey: string = process.env.MNEMONIC;
// ------------[  Configuration - End  ]------------



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
