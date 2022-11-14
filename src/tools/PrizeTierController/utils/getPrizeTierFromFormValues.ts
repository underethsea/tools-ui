import { PrizeTierConfig, calculate } from '@pooltogether/v4-utils-js'
import { EditPrizeTierFormValues } from '@prizeTierController/interfaces'
import { BigNumberish } from 'ethers'
import { parseUnits } from 'ethers/lib/utils'

export const getPrizeTierFromFormValues = (
  formValues: Partial<EditPrizeTierFormValues>,
  decimals: BigNumberish
): Partial<PrizeTierConfig> => {
  const prizeTier: Partial<PrizeTierConfig> = {
    bitRangeSize: formValues.bitRangeSize,
    expiryDuration: formValues.expiryDuration,
    maxPicksPerUser: formValues.maxPicksPerUser,
    tiers: undefined,
    prize: undefined
  }
  if (!!formValues.prize) {
    prizeTier.prize = parseUnits(formValues.prize, decimals)
  }
  if (!!formValues.tiers && !!formValues.bitRangeSize && !!formValues.prize) {
    prizeTier.tiers = formValues.tiers.map((tier, i) =>
      parseUnits(
        calculate
          .calculateTierPercentageForPrize(i, tier.value, formValues.bitRangeSize, prizeTier.prize)
          .toString(),
        decimals
      ).toNumber()
    )
  }
  return prizeTier
}
