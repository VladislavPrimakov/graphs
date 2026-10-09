import type { CldrUnitData, UnitDisplayStyle, UnitIdentifier } from '../src/utils/format';
import type { Language } from '../src/utils/provider';

/** Custom domain-specific unit definitions not present in Unicode CLDR standard. */
export const CUSTOM_UNITS: Record<Language, Record<UnitDisplayStyle, Partial<Record<UnitIdentifier, CldrUnitData>>>> = {
  en: {
    short: {
      'event-launch': {
        displayName: 'launch',
        perUnitPattern: '{0}/launch',
        'unitPattern-count-one': '{0} launch',
        'unitPattern-count-other': '{0} launches',
      },
      'energy-terawatt-hour': {
        displayName: 'TWh',
        'unitPattern-count-one': '{0} TWh',
        'unitPattern-count-other': '{0} TWh',
      },
      'energy-kilowatt-hour': {
        displayName: 'kWh',
        'unitPattern-count-one': '{0} kWh',
        'unitPattern-count-other': '{0} kWh',
      },
      person: {
        displayName: 'person',
        perUnitPattern: '{0}/person',
        'unitPattern-count-one': '{0} person',
        'unitPattern-count-other': '{0} people',
      },
    },
    long: {
      'event-launch': {
        displayName: 'launches',
        perUnitPattern: '{0} per launch',
        'unitPattern-count-one': '{0} launch',
        'unitPattern-count-other': '{0} launches',
      },
      'energy-terawatt-hour': {
        displayName: 'terawatt-hours',
        'unitPattern-count-one': '{0} terawatt-hour',
        'unitPattern-count-other': '{0} terawatt-hours',
      },
      'energy-kilowatt-hour': {
        displayName: 'kilowatt-hours',
        'unitPattern-count-one': '{0} kilowatt-hour',
        'unitPattern-count-other': '{0} kilowatt-hours',
      },
      person: {
        displayName: 'people',
        perUnitPattern: '{0} per person',
        'unitPattern-count-one': '{0} person',
        'unitPattern-count-other': '{0} people',
      },
    },
    narrow: {
      'event-launch': {
        displayName: 'launch',
        perUnitPattern: '{0}/launch',
        'unitPattern-count-one': '{0} launch',
        'unitPattern-count-other': '{0} launches',
      },
      'energy-terawatt-hour': {
        displayName: 'TWh',
        'unitPattern-count-one': '{0} TWh',
        'unitPattern-count-other': '{0} TWh',
      },
      'energy-kilowatt-hour': {
        displayName: 'kWh',
        'unitPattern-count-one': '{0} kWh',
        'unitPattern-count-other': '{0} kWh',
      },
      person: {
        displayName: 'person',
        perUnitPattern: '{0}/person',
        'unitPattern-count-one': '{0}p',
        'unitPattern-count-other': '{0}p',
      },
    },
  },
  ru: {
    short: {
      'event-launch': {
        displayName: 'запуск',
        perUnitPattern: '{0}/запуск',
        'unitPattern-count-one': '{0} запуск',
        'unitPattern-count-few': '{0} запуска',
        'unitPattern-count-many': '{0} запусков',
        'unitPattern-count-other': '{0} запуска',
      },
      'energy-terawatt-hour': {
        displayName: 'ТВт·ч',
        'unitPattern-count-one': '{0} ТВт·ч',
        'unitPattern-count-few': '{0} ТВт·ч',
        'unitPattern-count-many': '{0} ТВт·ч',
        'unitPattern-count-other': '{0} ТВт·ч',
      },
      'energy-kilowatt-hour': {
        displayName: 'кВт·ч',
        'unitPattern-count-one': '{0} кВт·ч',
        'unitPattern-count-few': '{0} кВт·ч',
        'unitPattern-count-many': '{0} кВт·ч',
        'unitPattern-count-other': '{0} кВт·ч',
      },
      person: {
        displayName: 'чел.',
        perUnitPattern: '{0}/чел.',
        'unitPattern-count-one': '{0} человек',
        'unitPattern-count-few': '{0} человека',
        'unitPattern-count-many': '{0} человек',
        'unitPattern-count-other': '{0} человека',
      },
    },
    long: {
      'event-launch': {
        displayName: 'запуски',
        perUnitPattern: '{0} на запуск',
        'unitPattern-count-one': '{0} запуск',
        'unitPattern-count-few': '{0} запуска',
        'unitPattern-count-many': '{0} запусков',
        'unitPattern-count-other': '{0} запуска',
      },
      'energy-terawatt-hour': {
        displayName: 'тераватт-часы',
        'unitPattern-count-one': '{0} тераватт-час',
        'unitPattern-count-few': '{0} тераватт-часа',
        'unitPattern-count-many': '{0} тераватт-часов',
        'unitPattern-count-other': '{0} тераватт-часа',
      },
      'energy-kilowatt-hour': {
        displayName: 'киловатт-часы',
        'unitPattern-count-one': '{0} киловатт-час',
        'unitPattern-count-few': '{0} киловатт-часа',
        'unitPattern-count-many': '{0} киловатт-часов',
        'unitPattern-count-other': '{0} киловатт-часа',
      },
      person: {
        displayName: 'человек',
        perUnitPattern: '{0} на человека',
        'unitPattern-count-one': '{0} человек',
        'unitPattern-count-few': '{0} человека',
        'unitPattern-count-many': '{0} человек',
        'unitPattern-count-other': '{0} человека',
      },
    },
    narrow: {
      'event-launch': {
        displayName: 'запуск',
        perUnitPattern: '{0}/запуск',
        'unitPattern-count-one': '{0} запуск',
        'unitPattern-count-few': '{0} запуска',
        'unitPattern-count-many': '{0} запусков',
        'unitPattern-count-other': '{0} запуска',
      },
      'energy-terawatt-hour': {
        displayName: 'ТВт·ч',
        'unitPattern-count-one': '{0} ТВт·ч',
        'unitPattern-count-few': '{0} ТВт·ч',
        'unitPattern-count-many': '{0} ТВт·ч',
        'unitPattern-count-other': '{0} ТВт·ч',
      },
      'energy-kilowatt-hour': {
        displayName: 'кВт·ч',
        'unitPattern-count-one': '{0} кВт·ч',
        'unitPattern-count-few': '{0} кВт·ч',
        'unitPattern-count-many': '{0} кВт·ч',
        'unitPattern-count-other': '{0} кВт·ч',
      },
      person: {
        displayName: 'чел.',
        perUnitPattern: '{0}/чел.',
        'unitPattern-count-one': '{0} чел.',
        'unitPattern-count-few': '{0} чел.',
        'unitPattern-count-many': '{0} чел.',
        'unitPattern-count-other': '{0} чел.',
      },
    },
  },
  uk: {
    short: {
      'event-launch': {
        displayName: 'запуск',
        perUnitPattern: '{0}/запуск',
        'unitPattern-count-one': '{0} запуск',
        'unitPattern-count-few': '{0} запуски',
        'unitPattern-count-many': '{0} запусків',
        'unitPattern-count-other': '{0} запуску',
      },
      'energy-terawatt-hour': {
        displayName: 'ТВт·год',
        'unitPattern-count-one': '{0} ТВт·год',
        'unitPattern-count-few': '{0} ТВт·год',
        'unitPattern-count-many': '{0} ТВт·год',
        'unitPattern-count-other': '{0} ТВт·год',
      },
      'energy-kilowatt-hour': {
        displayName: 'кВт·год',
        'unitPattern-count-one': '{0} кВт·год',
        'unitPattern-count-few': '{0} кВт·год',
        'unitPattern-count-many': '{0} кВт·год',
        'unitPattern-count-other': '{0} кВт·год',
      },
      person: {
        displayName: 'особа',
        perUnitPattern: '{0}/особу',
        'unitPattern-count-one': '{0} особа',
        'unitPattern-count-few': '{0} особи',
        'unitPattern-count-many': '{0} осіб',
        'unitPattern-count-other': '{0} особи',
      },
    },
    long: {
      'event-launch': {
        displayName: 'запуски',
        perUnitPattern: '{0} на запуск',
        'unitPattern-count-one': '{0} запуск',
        'unitPattern-count-few': '{0} запуски',
        'unitPattern-count-many': '{0} запусків',
        'unitPattern-count-other': '{0} запуску',
      },
      'energy-terawatt-hour': {
        displayName: 'терават-години',
        'unitPattern-count-one': '{0} терават-година',
        'unitPattern-count-few': '{0} терават-години',
        'unitPattern-count-many': '{0} терават-годин',
        'unitPattern-count-other': '{0} терават-години',
      },
      'energy-kilowatt-hour': {
        displayName: 'кіловат-години',
        'unitPattern-count-one': '{0} кіловат-година',
        'unitPattern-count-few': '{0} кіловат-години',
        'unitPattern-count-many': '{0} кіловат-годин',
        'unitPattern-count-other': '{0} кіловат-години',
      },
      person: {
        displayName: 'особи',
        perUnitPattern: '{0} на особу',
        'unitPattern-count-one': '{0} особа',
        'unitPattern-count-few': '{0} особи',
        'unitPattern-count-many': '{0} осіб',
        'unitPattern-count-other': '{0} особи',
      },
    },
    narrow: {
      'event-launch': {
        displayName: 'запуск',
        perUnitPattern: '{0}/запуск',
        'unitPattern-count-one': '{0} запуск',
        'unitPattern-count-few': '{0} запуски',
        'unitPattern-count-many': '{0} запусків',
        'unitPattern-count-other': '{0} запуску',
      },
      'energy-terawatt-hour': {
        displayName: 'ТВт·год',
        'unitPattern-count-one': '{0} ТВт·год',
        'unitPattern-count-few': '{0} ТВт·год',
        'unitPattern-count-many': '{0} ТВт·год',
        'unitPattern-count-other': '{0} ТВт·год',
      },
      'energy-kilowatt-hour': {
        displayName: 'кВт·год',
        'unitPattern-count-one': '{0} кВт·год',
        'unitPattern-count-few': '{0} кВт·год',
        'unitPattern-count-many': '{0} кВт·год',
        'unitPattern-count-other': '{0} кВт·год',
      },
      person: {
        displayName: 'ос.',
        perUnitPattern: '{0}/ос.',
        'unitPattern-count-one': '{0} ос.',
        'unitPattern-count-few': '{0} ос.',
        'unitPattern-count-many': '{0} ос.',
        'unitPattern-count-other': '{0} ос.',
      },
    },
  },
  de: {
    short: {
      'event-launch': {
        displayName: 'Start',
        perUnitPattern: '{0}/Start',
        'unitPattern-count-one': '{0} Start',
        'unitPattern-count-other': '{0} Starts',
      },
      'energy-terawatt-hour': {
        displayName: 'TWh',
        'unitPattern-count-one': '{0} TWh',
        'unitPattern-count-other': '{0} TWh',
      },
      'energy-kilowatt-hour': {
        displayName: 'kWh',
        'unitPattern-count-one': '{0} kWh',
        'unitPattern-count-other': '{0} kWh',
      },
      person: {
        displayName: 'Person',
        perUnitPattern: '{0}/Person',
        'unitPattern-count-one': '{0} Person',
        'unitPattern-count-other': '{0} Personen',
      },
    },
    long: {
      'event-launch': {
        displayName: 'Starts',
        perUnitPattern: '{0} pro Start',
        'unitPattern-count-one': '{0} Start',
        'unitPattern-count-other': '{0} Starts',
      },
      'energy-terawatt-hour': {
        displayName: 'Terawattstunden',
        'unitPattern-count-one': '{0} Terawattstunde',
        'unitPattern-count-other': '{0} Terawattstunden',
      },
      'energy-kilowatt-hour': {
        displayName: 'Kilowattstunden',
        'unitPattern-count-one': '{0} Kilowattstunde',
        'unitPattern-count-other': '{0} Kilowattstunden',
      },
      person: {
        displayName: 'Personen',
        perUnitPattern: '{0} pro Person',
        'unitPattern-count-one': '{0} Person',
        'unitPattern-count-other': '{0} Personen',
      },
    },
    narrow: {
      'event-launch': {
        displayName: 'Start',
        perUnitPattern: '{0}/Start',
        'unitPattern-count-one': '{0} Start',
        'unitPattern-count-other': '{0} Starts',
      },
      'energy-terawatt-hour': {
        displayName: 'TWh',
        'unitPattern-count-one': '{0} TWh',
        'unitPattern-count-other': '{0} TWh',
      },
      'energy-kilowatt-hour': {
        displayName: 'kWh',
        'unitPattern-count-one': '{0} kWh',
        'unitPattern-count-other': '{0} kWh',
      },
      person: {
        displayName: 'Person',
        perUnitPattern: '{0}/Person',
        'unitPattern-count-one': '{0} P.',
        'unitPattern-count-other': '{0} P.',
      },
    },
  },
};
