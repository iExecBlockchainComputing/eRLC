const { accounts, contract, web3, config } = require("@openzeppelin/test-environment");
const { constants, ether, BN, time, expectEvent, expectRevert } = require("@openzeppelin/test-helpers");
const { expect } = require("chai");


const { abi, bytecode } = require ("rlc-faucet-contract/build/contracts/RLC.json");
const RLC     = contract.fromABI(abi, bytecode);
const KERC20  = contract.fromArtifact("KERC20");

describe("KERC20", function () {
  const [ admin, kycadmin, kycuser1, kycuser2, user1, user2, other1, other2 ] = accounts;

  beforeEach(async function () {
    this.rlc  = await RLC.new({ from: admin });
    this.krlc = await KERC20.new(this.rlc.address, "iExec KRLC Token", "KRLC", 0, [ kycadmin ], { from: admin });

    this.roles = {
      DEFAULT_ADMIN_ROLE: await this.krlc.DEFAULT_ADMIN_ROLE(),
      KYC_ADMIN_ROLE:     await this.krlc.KYC_ADMIN_ROLE(),
      KYC_MEMBER_ROLE:    await this.krlc.KYC_MEMBER_ROLE(),
    }

    this.value = new BN("1000");

    await Promise.all(
      [ kycuser1, kycuser2, user1, user2 ]
      .map(to => this.rlc.transfer(to, this.value, { from: admin }))
    );

    await Promise.all(
      [ kycuser1, kycuser2 ]
      .map(to => this.krlc.grantRole(this.roles.KYC_MEMBER_ROLE, to, { from: kycadmin }))
    );
  });

  it("initial state", async function () {
    expect(await this.rlc.name()).to.be.equal("iExec RLC Token");
    expect(await this.rlc.symbol()).to.be.equal("RLC");
    expect(await this.rlc.decimals()).to.be.bignumber.equal("9");
    expect(await this.rlc.totalSupply()).to.be.bignumber.equal("87000000000000000");
    expect(await this.krlc.name()).to.be.equal("iExec KRLC Token");
    expect(await this.krlc.symbol()).to.be.equal("KRLC");
    expect(await this.krlc.decimals()).to.be.bignumber.equal("9");
    expect(await this.krlc.totalSupply()).to.be.bignumber.equal("0");
  });

  describe("token movements", async function () {
    describe("deposit", async function () {
      describe("2-steps", async function () {
        it("missing approve", async function () {
          const from  = kycuser1;

          await expectRevert.unspecified(this.krlc.deposit(this.value, { from }));
        });

        it("missing kyc", async function () {
          const from  = user1;

          await this.rlc.approve(this.krlc.address, this.value, { from });
          await expectRevert(this.krlc.deposit(this.value, { from }), "Receiver is missing KYC");
        });

        it("with kyc", async function () {
          const from  = kycuser1;

          expect(await this.rlc.balanceOf(from)).to.be.bignumber.equal(this.value);
          expect(await this.krlc.balanceOf(from)).to.be.bignumber.equal("0");

          await this.rlc.approve(this.krlc.address, this.value, { from });
          const { tx } = await this.krlc.deposit(this.value, { from });
          await expectEvent.inTransaction(tx, this.rlc,  "Transfer", { from: from,                   to: this.krlc.address, value: this.value });
          await expectEvent.inTransaction(tx, this.krlc, "Transfer", { from: constants.ZERO_ADDRESS, to: from,              value: this.value });

          expect(await this.rlc.balanceOf(from)).to.be.bignumber.equal("0");
          expect(await this.krlc.balanceOf(from)).to.be.bignumber.equal(this.value);
        });
      });

      describe("1-steps", async function () {
        it("missing kyc", async function () {
          const from  = user1;

          await expectRevert(this.rlc.approveAndCall(this.krlc.address, this.value, this.krlc.contract.methods.deposit(this.value.toString()).encodeABI(), { from }), "Receiver is missing KYC");
        });

        it("with kyc", async function () {
          const from  = kycuser1;

          expect(await this.rlc.balanceOf(from)).to.be.bignumber.equal(this.value);
          expect(await this.krlc.balanceOf(from)).to.be.bignumber.equal("0");

          const { tx } = await this.rlc.approveAndCall(this.krlc.address, this.value, this.krlc.contract.methods.deposit(this.value.toString()).encodeABI(), { from });
          await expectEvent.inTransaction(tx, this.rlc,  "Transfer", { from: from,                   to: this.krlc.address, value: this.value });
          await expectEvent.inTransaction(tx, this.krlc, "Transfer", { from: constants.ZERO_ADDRESS, to: from,              value: this.value });

          expect(await this.rlc.balanceOf(from)).to.be.bignumber.equal("0");
          expect(await this.krlc.balanceOf(from)).to.be.bignumber.equal(this.value);
        });
      });
    });

    describe("transfer", async function () {
      beforeEach(async function () {
        await this.rlc.approveAndCall(this.krlc.address, this.value, this.krlc.contract.methods.deposit(this.value.toString()).encodeABI(), { from: kycuser1 });
      });

      it("from missing kyc", async function () {
        await expectRevert(this.krlc.transfer(kycuser1, this.value, { from: user1 }), "Sender is missing KYC");
      });
      it("to missing kyc", async function () {
        await expectRevert(this.krlc.transfer(user1, this.value, { from: kycuser1 }), "Receiver is missing KYC");
      });
      it("with kyc", async function () {
        const { tx } = await this.krlc.transfer(kycuser2, this.value, { from: kycuser1 })
        await expectEvent.inTransaction(tx, this.krlc, "Transfer", { from: kycuser1, to: kycuser2, value: this.value });
      });
    });

    describe("withdraw", async function () {
      beforeEach(async function () {
        await this.rlc.approveAndCall(this.krlc.address, this.value, this.krlc.contract.methods.deposit(this.value.toString()).encodeABI(), { from: kycuser1 });
      });

      it("with kyc", async function () {
        const from = kycuser1;

        expect(await this.rlc.balanceOf(from)).to.be.bignumber.equal("0");
        expect(await this.krlc.balanceOf(from)).to.be.bignumber.equal(this.value);

        const { tx } = await this.krlc.withdraw(this.value, { from })
        await expectEvent.inTransaction(tx, this.krlc, "Transfer", { from: from,              to: constants.ZERO_ADDRESS, value: this.value });
        await expectEvent.inTransaction(tx, this.rlc,  "Transfer", { from: this.krlc.address, to: from,                   value: this.value });

        expect(await this.rlc.balanceOf(from)).to.be.bignumber.equal(this.value);
        expect(await this.krlc.balanceOf(from)).to.be.bignumber.equal("0");
      });

      it("without kyc", async function () {
        const from = kycuser1;

        expect(await this.rlc.balanceOf(from)).to.be.bignumber.equal("0");
        expect(await this.krlc.balanceOf(from)).to.be.bignumber.equal(this.value);

        await this.krlc.revokeRole(this.roles.KYC_MEMBER_ROLE, from, { from: kycadmin });

        await expectRevert(this.krlc.withdraw(this.value, { from }), 'Sender is missing KYC');

        // const { tx } = await this.krlc.withdraw(this.value, { from })
        // await expectEvent.inTransaction(tx, this.krlc, "Transfer", { from: from,              to: constants.ZERO_ADDRESS, value: this.value });
        // await expectEvent.inTransaction(tx, this.rlc,  "Transfer", { from: this.krlc.address, to: from,                   value: this.value });

        // expect(await this.rlc.balanceOf(from)).to.be.bignumber.equal(this.value);
        // expect(await this.krlc.balanceOf(from)).to.be.bignumber.equal("0");
      });
    });
  });

  async function checkRoleChange(contract, role, account, sender, fname, ename = null)
  {
    if (ename)
    {
      expectEvent(await contract[fname](role, account, { from: sender }), ename, { role, account, sender });
    }
    else
    {
      await expectRevert(contract[fname](role, account, { from: sender }), 'AccessControl: sender must be an admin to');
    }
  }

  describe("role management", function () {
    describe("role: kyc member", function () {
      describe("grant", function () {
        it("by default admin - no", async function () { await checkRoleChange(this.krlc, this.roles.KYC_MEMBER_ROLE, other2, admin,    'grantRole')                });
        it("by kyc admin - no",     async function () { await checkRoleChange(this.krlc, this.roles.KYC_MEMBER_ROLE, other2, kycadmin, 'grantRole', 'RoleGranted') });
        it("by kyc member - no",    async function () { await checkRoleChange(this.krlc, this.roles.KYC_MEMBER_ROLE, other2, kycuser1, 'grantRole')                });
        it("by other - no",         async function () { await checkRoleChange(this.krlc, this.roles.KYC_MEMBER_ROLE, other2, other1,   'grantRole')                });
      });

      describe("revoke", function () {
        beforeEach(async function () { await this.krlc.grantRole(this.roles.KYC_MEMBER_ROLE, other2, { from: kycadmin }) });
        it("by default admin - no", async function () { await checkRoleChange(this.krlc, this.roles.KYC_MEMBER_ROLE, other2, admin,    'revokeRole')                });
        it("by kyc admin - no",     async function () { await checkRoleChange(this.krlc, this.roles.KYC_MEMBER_ROLE, other2, kycadmin, 'revokeRole', 'RoleRevoked') });
        it("by kyc member - no",    async function () { await checkRoleChange(this.krlc, this.roles.KYC_MEMBER_ROLE, other2, kycuser1, 'revokeRole')                });
        it("by other - no",         async function () { await checkRoleChange(this.krlc, this.roles.KYC_MEMBER_ROLE, other2, other1,   'revokeRole')                });
      });
    });

    describe("role: kyc admin", function () {
      describe("grant", function () {
        it("by default admin - no", async function () { await checkRoleChange(this.krlc, this.roles.KYC_ADMIN_ROLE, other2, admin,    'grantRole', 'RoleGranted') });
        it("by kyc admin - no",     async function () { await checkRoleChange(this.krlc, this.roles.KYC_ADMIN_ROLE, other2, kycadmin, 'grantRole')                });
        it("by kyc member - no",    async function () { await checkRoleChange(this.krlc, this.roles.KYC_ADMIN_ROLE, other2, kycuser1, 'grantRole')                });
        it("by other - no",         async function () { await checkRoleChange(this.krlc, this.roles.KYC_ADMIN_ROLE, other2, other1,   'grantRole')                });
      });

      describe("revoke", function () {
        beforeEach(async function () { await this.krlc.grantRole(this.roles.KYC_ADMIN_ROLE, other2, { from: admin }) });
        it("by default admin - no", async function () { await checkRoleChange(this.krlc, this.roles.KYC_ADMIN_ROLE, other2, admin,    'revokeRole', 'RoleRevoked') });
        it("by kyc admin - no",     async function () { await checkRoleChange(this.krlc, this.roles.KYC_ADMIN_ROLE, other2, kycadmin, 'revokeRole')                });
        it("by kyc member - no",    async function () { await checkRoleChange(this.krlc, this.roles.KYC_ADMIN_ROLE, other2, kycuser1, 'revokeRole')                });
        it("by other - no",         async function () { await checkRoleChange(this.krlc, this.roles.KYC_ADMIN_ROLE, other2, other1,   'revokeRole')                });
      });
    });

    describe("role: admin", function () {
      describe("grant", function () {
        it("by default admin - no", async function () { await checkRoleChange(this.krlc, this.roles.DEFAULT_ADMIN_ROLE, other2, admin,    'grantRole', 'RoleGranted') });
        it("by kyc admin - no",     async function () { await checkRoleChange(this.krlc, this.roles.DEFAULT_ADMIN_ROLE, other2, kycadmin, 'grantRole')                });
        it("by kyc member - no",    async function () { await checkRoleChange(this.krlc, this.roles.DEFAULT_ADMIN_ROLE, other2, kycuser1, 'grantRole')                });
        it("by other - no",         async function () { await checkRoleChange(this.krlc, this.roles.DEFAULT_ADMIN_ROLE, other2, other1,   'grantRole')                });
      });

      describe("revoke", function () {
        beforeEach(async function () { await this.krlc.grantRole(this.roles.DEFAULT_ADMIN_ROLE, other2, { from: admin }) });
        it("by default admin - no", async function () { await checkRoleChange(this.krlc, this.roles.DEFAULT_ADMIN_ROLE, other2, admin,    'revokeRole', 'RoleRevoked') });
        it("by kyc admin - no",     async function () { await checkRoleChange(this.krlc, this.roles.DEFAULT_ADMIN_ROLE, other2, kycadmin, 'revokeRole')                });
        it("by kyc member - no",    async function () { await checkRoleChange(this.krlc, this.roles.DEFAULT_ADMIN_ROLE, other2, kycuser1, 'revokeRole')                });
        it("by other - no",         async function () { await checkRoleChange(this.krlc, this.roles.DEFAULT_ADMIN_ROLE, other2, other1,   'revokeRole')                });
      });
    });

  });
});
