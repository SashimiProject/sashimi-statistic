import {
  Harvested,
  ProviderAdded,
  ProviderDisabled,
  ProviderEnabled,
  ProviderSwitched
} from './types/Investment/Investment';
import {DayBonus, Harvest, Pair, Provider, Token, TotalBonus} from './types/schema';
import {Address, BigInt, BigDecimal} from '@graphprotocol/graph-ts'
import {
  fetchTokenDecimals,
  fetchTokenName,
  fetchTokenSymbol,
  getProviderLend,
  getProviderOwner,
  getProviderProfit,
  addTransaction,
  convertTokenToDecimal
} from './utils';

function addToken(token: Address): void {
  let tokenInfo = Token.load(token.toHexString());
  if (tokenInfo === null) {
    tokenInfo = new Token(token.toHexString());
    tokenInfo.symbol = fetchTokenSymbol(token);
    tokenInfo.name = fetchTokenName(token);
    tokenInfo.decimals = fetchTokenDecimals(token);
    if (tokenInfo.symbol !== 'unknown') {
      tokenInfo.save();
    }
  }
}

const SASHIMI = '0xc28e27870558cf22add83540d2126da2e4b464c2';

export function handleNewProvider(event: ProviderAdded): void {
  addToken(Address.fromString(SASHIMI));
  const token = event.params.token;
  const providerAddress = event.params.provider;
  const providerId = event.params.providerId;
  addToken(token);
  let provider = Provider.load(providerId.toString());
  if (provider === null) {
    provider = new Provider(providerId.toString());
    provider.address = providerAddress;
    let owner = getProviderOwner(providerAddress);
    let profit = getProviderProfit(providerAddress);
    let lend = getProviderLend(providerAddress);
    provider.token = token;
    provider.lend = lend;
    provider.owner = owner;
    provider.profit = profit;
    provider.enable = true;
    provider.save();
    addToken(profit);
  }
  addTransaction(event);
}

export function handleProviderSwitched(event: ProviderSwitched): void {
  const token = event.params.token;
  const providerId = event.params.providerId;
  let pair = new Pair(token.toHexString());
  pair.deposit = Token.load(token.toHexString()).id;
  pair.provider = Provider.load(providerId.toString()).id;
  pair.save();
  addTransaction(event);
}

export function handleProviderDisabled(event: ProviderDisabled): void {
  const providerId = event.params.providerId;
  let provider = Provider.load(providerId.toString());
  if (provider !== null) {
    provider.enable = false;
    provider.save();
  }
  addTransaction(event);
}

export function handleProviderEnabled(event: ProviderEnabled): void {
  const providerId = event.params.providerId;
  let provider = Provider.load(providerId.toString());
  if (provider !== null) {
    provider.enable = true;
    provider.save();
  }
  addTransaction(event);
}

const daySeconds = BigInt.fromI32(24 * 60 * 60);

function handleDayBonus(
  timestamp: BigInt,
  depositAddress: Address,
  bonusAddress: Address,
  amount: BigDecimal,
  sashimiAmount: BigDecimal
): void {
  let dayID = timestamp.div(daySeconds);
  let dayStartTimestamp = dayID.times(daySeconds);
  let dayBonusID = depositAddress.toHexString() + '-' + dayID.toString();
  let dayBonus = DayBonus.load(dayBonusID);
  const bonusToken = Token.load(bonusAddress.toHexString());
  if (dayBonus === null) {
    dayBonus = new DayBonus(dayBonusID);
    dayBonus.date = dayStartTimestamp;
    dayBonus.bonus = bonusToken.id;
    dayBonus.amount = BigDecimal.fromString('0');
    dayBonus.sashimiAmount = BigDecimal.fromString('0');
    dayBonus.txCount = BigInt.fromI32(0);
    dayBonus.save();
  }
  dayBonus = DayBonus.load(dayBonusID);
  dayBonus.amount = dayBonus.amount.plus(amount);
  dayBonus.sashimiAmount = dayBonus.sashimiAmount.plus(sashimiAmount);
  dayBonus.txCount = dayBonus.txCount.plus(BigInt.fromI32(1));
  dayBonus.save();
}

function handleTotalBonus(
  depositAddress: Address,
  bonusAddress: Address,
  amount: BigDecimal,
  sashimiAmount: BigDecimal
): void {
  let totalBonus = TotalBonus.load(depositAddress.toHexString());
  const bonusToken = Token.load(bonusAddress.toHexString());
  if (totalBonus === null) {
    totalBonus = new TotalBonus(depositAddress.toHexString());
    totalBonus.bonus = bonusToken.id;
    totalBonus.amount = BigDecimal.fromString('0');
    totalBonus.sashimiAmount = BigDecimal.fromString('0');
    totalBonus.txCount = BigInt.fromI32(0);
    totalBonus.save();
  }
  totalBonus = TotalBonus.load(depositAddress.toHexString());
  totalBonus.amount = totalBonus.amount.plus(amount);
  totalBonus.sashimiAmount = totalBonus.sashimiAmount.plus(sashimiAmount);
  totalBonus.txCount = totalBonus.txCount.plus(BigInt.fromI32(1));
  totalBonus.save();
}

export function handleHarvested(event: Harvested): void {
  const depositTokenAddress = event.params.deposit;
  const profitTokenAddress = event.params.profit;
  const profitTokenAmount = event.params.amount0;
  const sashimiTokenAmount = event.params.amount1;
  const earnToken = Token.load(profitTokenAddress.toHexString());
  const sashimiToken = Token.load(SASHIMI);

  const profitAmount = convertTokenToDecimal(profitTokenAmount, earnToken.decimals);
  const sashimiAmount = convertTokenToDecimal(sashimiTokenAmount, sashimiToken.decimals);

  const timestamp = event.block.timestamp;
  const sender = event.transaction.from;
  let pair = Pair.load(depositTokenAddress.toHexString());
  const providerId = pair.provider;
  let provider = Provider.load(providerId);
  const transactionHash = addTransaction(event);
  let harvest = new Harvest(transactionHash + '-' + depositTokenAddress.toHexString());
  harvest.transaction = transactionHash;
  harvest.provider = provider.id;
  harvest.timestamp = timestamp;
  harvest.depositToken = Token.load(depositTokenAddress.toHexString()).id;
  harvest.earnToken = earnToken.id;
  harvest.earns = profitAmount;
  harvest.earnsInSashimi = sashimiAmount;
  harvest.sender = sender;
  harvest.save();

  handleDayBonus(timestamp, depositTokenAddress, profitTokenAddress, profitAmount, sashimiAmount);
  handleTotalBonus(depositTokenAddress, profitTokenAddress, profitAmount, sashimiAmount);
}
