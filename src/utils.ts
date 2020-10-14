import {Address, BigDecimal, BigInt, ethereum} from '@graphprotocol/graph-ts';
import {ERC20} from './types/Investment/ERC20';
import {ERC20SymbolBytes} from './types/Investment/ERC20SymbolBytes';
import {ERC20NameBytes} from './types/Investment/ERC20NameBytes';
import {Vault} from './types/Investment/Vault';
import {Transaction} from './types/schema';

export const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000';
export let ZERO_BI = BigInt.fromI32(0);
export let ONE_BI = BigInt.fromI32(1);

export function isNullEthValue(value: string): boolean {
  return value == '0x0000000000000000000000000000000000000000000000000000000000000001';
}

export function exponentToBigDecimal(decimals: BigInt): BigDecimal {
  let bd = BigDecimal.fromString('1')
  for (let i = ZERO_BI; i.lt(decimals as BigInt); i = i.plus(ONE_BI)) {
    bd = bd.times(BigDecimal.fromString('10'))
  }
  return bd
}

export function convertTokenToDecimal(tokenAmount: BigInt, exchangeDecimals: BigInt): BigDecimal {
  if (exchangeDecimals == ZERO_BI) {
    return tokenAmount.toBigDecimal()
  }
  return tokenAmount.toBigDecimal().div(exponentToBigDecimal(exchangeDecimals))
}

export function fetchTokenSymbol(tokenAddress: Address): string {
  let contract = ERC20.bind(tokenAddress)
  let contractSymbolBytes = ERC20SymbolBytes.bind(tokenAddress)

  // try types string and bytes32 for symbol
  let symbolValue = 'unknown'
  let symbolResult = contract.try_symbol()
  if (symbolResult.reverted) {
    let symbolResultBytes = contractSymbolBytes.try_symbol()
    if (!symbolResultBytes.reverted) {
      // for broken pairs that have no symbol function exposed
      if (!isNullEthValue(symbolResultBytes.value.toHexString())) {
        symbolValue = symbolResultBytes.value.toString()
      }
    }
  } else {
    symbolValue = symbolResult.value
  }

  return symbolValue
}

export function fetchTokenName(tokenAddress: Address): string {
  // hard coded override
  if (tokenAddress.toHexString() == '0xe0b7927c4af23765cb51314a0e0521a9645f0e2a') {
    return 'DGD'
  }

  let contract = ERC20.bind(tokenAddress)
  let contractNameBytes = ERC20NameBytes.bind(tokenAddress)

  // try types string and bytes32 for name
  let nameValue = 'unknown'
  let nameResult = contract.try_name()
  if (nameResult.reverted) {
    let nameResultBytes = contractNameBytes.try_name()
    if (!nameResultBytes.reverted) {
      // for broken exchanges that have no name function exposed
      if (!isNullEthValue(nameResultBytes.value.toHexString())) {
        nameValue = nameResultBytes.value.toString()
      }
    }
  } else {
    nameValue = nameResult.value
  }

  return nameValue
}

export function fetchTokenDecimals(tokenAddress: Address): BigInt {
  let contract = ERC20.bind(tokenAddress)
  // try types uint8 for decimals
  let decimalValue = null
  let decimalResult = contract.try_decimals()
  if (!decimalResult.reverted) {
    decimalValue = decimalResult.value
  }
  return BigInt.fromI32(decimalValue as i32)
}

export function getProviderLend(provider: Address): Address {
  let contract = Vault.bind(provider);
  let lend = Address.fromString(ADDRESS_ZERO);
  let lendResult = contract.try_lend();
  if (!lendResult.reverted) {
    lend = lendResult.value;
  }
  return lend;
}

export function getProviderOwner(provider: Address): Address {
  let contract = Vault.bind(provider);
  let owner = Address.fromString(ADDRESS_ZERO);
  let ownerResult = contract.try_owner();
  if (!ownerResult.reverted) {
    owner = ownerResult.value;
  }
  return owner;
}

export function getProviderProfit(provider: Address): Address {
  let contract = Vault.bind(provider);
  let profit = Address.fromString(ADDRESS_ZERO);
  let profitResult = contract.try_profit();
  if (!profitResult.reverted) {
    profit = profitResult.value;
  }
  return profit;
}

export function addTransaction(event: ethereum.Event): string {
  let transactionHash = event.transaction.hash.toHexString();
  let transaction = Transaction.load(transactionHash);

  if (transaction == null) {
    transaction = new Transaction(transactionHash);
    transaction.blockNumber = event.block.number;
    transaction.timestamp = event.block.timestamp;
    transaction.save();
  }
  return transaction.id;
}
