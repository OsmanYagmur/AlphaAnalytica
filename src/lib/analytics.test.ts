import { describe, expect, it } from 'vitest'
import { analyticsRoute } from './analytics'

describe('analyticsRoute', () => {
  it('firma kimliklerini kalıpta toplar, diğer yolları olduğu gibi bırakır', () => {
    expect(analyticsRoute('/')).toBe('/')
    expect(analyticsRoute('')).toBe('/')
    expect(analyticsRoute('/demo')).toBe('/demo')
    expect(analyticsRoute('/tahsis')).toBe('/tahsis')
    expect(analyticsRoute('/tahsis/firma/defne-kirtasiye')).toBe('/tahsis/firma/[firma]')
    expect(analyticsRoute('/tahsis/firma/denizli-dokuma/kkb')).toBe('/tahsis/firma/[firma]/kkb')
    expect(analyticsRoute('/portfoy/firma/mavi-sepet')).toBe('/portfoy/firma/[firma]')
    expect(analyticsRoute('/portfoy/firmalar')).toBe('/portfoy/firmalar')
    expect(analyticsRoute('/model/kkb')).toBe('/model/kkb')
  })
})
