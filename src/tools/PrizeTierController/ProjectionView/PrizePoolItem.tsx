import { StyledInput } from '@components/Input'
import { Label } from '@components/Label'
import { Token } from '@pooltogether/hooks'
import { PrizePool } from '@pooltogether/v4-client-js'
import { calculate } from '@pooltogether/v4-utils-js'
import { allCombinedPrizeTiersAtom, allProjectionSettingsAtom } from '@prizeTierController/atoms'
import { DRAWS_PER_DAY } from '@prizeTierController/config'
import { usePrizePoolTvl } from '@prizeTierController/hooks/usePrizePoolTvl'
import { usePrizeTierHistoryData } from '@prizeTierController/hooks/usePrizeTierHistoryData'
import {
  PrizeTierConfigV2,
  PrizeTierHistoryContract,
  ProjectionSettings
} from '@prizeTierController/interfaces'
import { PrizeTierHistoryTitle } from '@prizeTierController/PrizeTierHistoryTitle'
import { calculateDprMultiplier } from '@prizeTierController/utils/calculateDprMultiplier'
import { formatPrettyPercentage } from '@prizeTierController/utils/formatPrettyPercentage'
import classNames from 'classnames'
import { formatUnits } from 'ethers/lib/utils'
import { useAtom } from 'jotai'
import { useTranslation } from 'next-i18next'
import { useEffect, useMemo } from 'react'
import { FieldErrorsImpl, useForm, UseFormRegister, UseFormSetValue } from 'react-hook-form'

// TODO: localization

export const PrizePoolItem = (props: {
  prizePool: PrizePool
  prizeTierHistoryContract: PrizeTierHistoryContract
}) => {
  const { prizePool, prizeTierHistoryContract } = props
  const [combinedPrizeTiers] = useAtom(allCombinedPrizeTiersAtom)
  const [allProjectionSettings] = useAtom(allProjectionSettingsAtom)
  const { data: upcomingPrizeTier, isFetched } = usePrizeTierHistoryData(prizeTierHistoryContract)
  const { t } = useTranslation()

  const prizeTier = useMemo(() => {
    if (!!prizePool && !!prizeTierHistoryContract && !!combinedPrizeTiers) {
      const editedPrizeTier =
        combinedPrizeTiers[prizePool.chainId]?.[prizeTierHistoryContract.address]
      if (!!editedPrizeTier) {
        return editedPrizeTier
      } else if (isFetched) {
        return upcomingPrizeTier
      }
    }
  }, [prizePool, prizeTierHistoryContract, combinedPrizeTiers, isFetched])

  const projectionSettings = allProjectionSettings[prizePool.chainId]?.[prizePool.id()]

  return (
    <li className='p-4 bg-actually-black bg-opacity-10 rounded-xl'>
      <PrizeTierHistoryTitle prizeTierHistoryContract={prizeTierHistoryContract} className='mb-4' />
      {!!prizeTier ? (
        <PrizePoolProjections
          prizePool={prizePool}
          prizeTierHistoryContract={prizeTierHistoryContract}
          prizeTier={prizeTier}
          projectionSettings={projectionSettings}
        />
      ) : (
        t('loading')
      )}
    </li>
  )
}

const PrizePoolProjections = (props: {
  prizePool: PrizePool
  prizeTierHistoryContract: PrizeTierHistoryContract
  prizeTier: PrizeTierConfigV2
  projectionSettings: ProjectionSettings
}) => {
  const { prizePool, prizeTierHistoryContract, prizeTier, projectionSettings } = props
  const { data: tvl, isFetched: isFetchedTvl } = usePrizePoolTvl(prizePool)
  const [allProjectionSettings, setAllProjectionSettings] = useAtom(allProjectionSettingsAtom)
  const {
    register,
    watch,
    setValue,
    formState: { errors, isValid }
  } = useForm<ProjectionSettings>({
    mode: 'onChange',
    defaultValues: projectionSettings ?? { tvl: '0', variance: '0' },
    shouldUnregister: true
  })
  const { t } = useTranslation()

  // TODO: make `isListCollapsed` atom also affect projections

  const formTvl = watch('tvl')
  const parsedFormTvl = parseFloat(formTvl?.replaceAll(',', ''))

  // TODO: abstract out some of this logic elsewhere
  useEffect(() => {
    if (isFetchedTvl && (formTvl === '0' || formTvl === undefined)) {
      setValue('tvl', tvl.toLocaleString('en', { maximumFractionDigits: 0 }))
      if (allProjectionSettings[prizePool.chainId]?.[prizePool.id()] === undefined) {
        setAllProjectionSettings(() => {
          const updatedProjectionSettings = { ...allProjectionSettings }
          if (!updatedProjectionSettings[prizePool.chainId]) {
            updatedProjectionSettings[prizePool.chainId] = {}
          }
          updatedProjectionSettings[prizePool.chainId][prizePool.id()] = {
            tvl: tvl.toString(),
            variance: updatedProjectionSettings[prizePool.chainId][prizePool.id()]?.variance ?? '0'
          }
          return updatedProjectionSettings
        })
      }
    } else if (!!parsedFormTvl) {
      setAllProjectionSettings(() => {
        const updatedProjectionSettings = { ...allProjectionSettings }
        if (!updatedProjectionSettings[prizePool.chainId]) {
          updatedProjectionSettings[prizePool.chainId] = {}
        }
        updatedProjectionSettings[prizePool.chainId][prizePool.id()] = {
          tvl: formTvl,
          variance: updatedProjectionSettings[prizePool.chainId][prizePool.id()]?.variance ?? '0'
        }
        return updatedProjectionSettings
      })
    }
  }, [tvl, isFetchedTvl, formTvl, parsedFormTvl])

  const dprMultiplier = !!parsedFormTvl
    ? calculateDprMultiplier(
        prizeTier.dpr,
        parsedFormTvl,
        prizeTier.prize,
        prizeTierHistoryContract.token.decimals
      )
    : 0

  const prizes = prizeTier.tiers.map((tier, i) =>
    parseFloat(
      formatUnits(
        calculate.calculatePrizeForTierPercentage(i, tier, prizeTier.bitRangeSize, prizeTier.prize),
        parseInt(prizeTierHistoryContract.token.decimals)
      )
    )
  )
  const numPrizesPerTier = calculate.calculateNumberOfPrizesPerTier(prizeTier)
  const prizeChances = numPrizesPerTier.map((value) => value * dprMultiplier)

  const expectedTierPrizeAmounts = prizes.map((prize, i) => prize * prizeChances[i])
  const expectedPrizeAmount = expectedTierPrizeAmounts.reduce((a, b) => a + b, 0)

  return (
    <>
      {isFetchedTvl ? (
        <>
          <BasicStats
            tvl={tvl}
            dpr={prizeTier.dpr}
            className='mb-2'
            errors={errors}
            register={register}
            setValue={setValue}
          />
          <DrawBreakdown
            prizeAmount={expectedPrizeAmount}
            prizes={prizes}
            prizeChances={prizeChances}
            token={prizeTierHistoryContract.token}
            className='mb-2'
          />
          <PrizesOverTime
            prizeAmount={expectedPrizeAmount}
            token={prizeTierHistoryContract.token}
            className='mb-2'
          />
          <VarianceInput />
        </>
      ) : (
        t('loading')
      )}
    </>
  )
}

const BasicStats = (props: {
  tvl: number
  dpr: number
  className?: string
  errors: FieldErrorsImpl<ProjectionSettings>
  register: UseFormRegister<ProjectionSettings>
  setValue: UseFormSetValue<ProjectionSettings>
}) => {
  const { tvl, dpr, className, errors, register, setValue } = props
  const { t } = useTranslation()

  return (
    <div className={classNames('flex flex-col', className)}>
      <SectionTitle text='Basic Stats' />
      <ProjectionInput
        title='TVL'
        formKey='tvl'
        validate={{
          isValidNumber: (v) =>
            !Number.isNaN(Number(v.replaceAll(',', ''))) ||
            t('fieldIsInvalid', { field: t('tier') }),
          isGreaterThanOrEqualToZero: (v) =>
            parseFloat(v.replaceAll(',', '')) >= 0 || t('fieldIsInvalid', { field: t('tier') })
        }}
        errors={errors}
        register={register}
      />
      <button
        className='text-xxs opacity-80'
        onClick={() => setValue('tvl', tvl.toLocaleString('en', { maximumFractionDigits: 0 }))}
      >
        Reset TVL
      </button>
      <span>DPR: {formatPrettyPercentage(dpr)}</span>
    </div>
  )
}

const DrawBreakdown = (props: {
  prizeAmount: number
  prizes: number[]
  prizeChances: number[]
  token: Token
  className?: string
}) => {
  const { prizeAmount, prizes, prizeChances, token, className } = props

  const formattedPrizeAmount = prizeAmount.toLocaleString('en', { maximumFractionDigits: 0 })

  // TODO: show claimable vs dropped prizes estimates (make dropped prizes a % input - default 15%?)
  // TODO: remake breakdown as table (prize, daily, weekly, monthly, yearly)
  // TODO: add minimum time until prize (10 days, etc.)
  // TODO: maybe add a toggle between breakdown and min time until prize?

  return (
    <div className={classNames('flex flex-col', className)}>
      <SectionTitle text='Draw Breakdown' />
      <span>
        Total Estimated Prizes: {formattedPrizeAmount} {token.symbol}
      </span>
      <ul>
        {prizes.map((prize, i) => {
          if (prize === 0) return null

          return (
            <li key={`pl-${i}-${prizeChances[i]}`}>
              {prizeChances[i].toLocaleString('en', { maximumFractionDigits: 4 })} prizes of{' '}
              {prize.toLocaleString('en', { maximumFractionDigits: 2 })} {token.symbol}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// TODO: bring prizes over time into basic stats
const PrizesOverTime = (props: { prizeAmount: number; token: Token; className?: string }) => {
  const { prizeAmount, token, className } = props

  const formattedWeeklyPrizeAmount = (prizeAmount * 7 * DRAWS_PER_DAY).toLocaleString('en', {
    maximumFractionDigits: 0
  })
  const formattedYearlyPrizeAmount = (prizeAmount * 365 * DRAWS_PER_DAY).toLocaleString('en', {
    maximumFractionDigits: 0
  })

  // TODO: show yearly APR (DPR * 365)

  return (
    <div className={classNames('flex flex-col', className)}>
      <SectionTitle text='Prizes Over Time' />
      <span>
        Weekly prizes: {formattedWeeklyPrizeAmount} {token.symbol}
      </span>
      <span>
        Yearly prizes: {formattedYearlyPrizeAmount} {token.symbol}
      </span>
    </div>
  )
}

const VarianceInput = () => {
  // TODO: include variance input to change charts, estimates, etc.

  return <></>
}

const SectionTitle = (props: { text: string; className?: string }) => {
  return <h3 className={classNames('text-xs opacity-80', props.className)}>{props.text}</h3>
}

const ProjectionInput = (props: {
  title: string
  formKey: keyof ProjectionSettings
  validate?: Record<string, (v: any) => true | string>
  disabled?: boolean
  errors: FieldErrorsImpl<ProjectionSettings>
  register: UseFormRegister<ProjectionSettings>
}) => {
  const { title, formKey, validate, disabled, errors, register } = props
  const { t } = useTranslation()

  return (
    <div>
      <Label className='uppercase' htmlFor={formKey}>
        {title}
      </Label>
      <StyledInput
        id={formKey}
        invalid={!!errors[formKey]}
        className='w-full'
        {...register(formKey, {
          required: {
            value: true,
            message: t('blankIsRequired', { blank: title })
          },
          validate: validate
        })}
        disabled={disabled}
      />
    </div>
  )
}
