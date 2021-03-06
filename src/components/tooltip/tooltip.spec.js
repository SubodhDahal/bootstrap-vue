import Tooltip from './tooltip'
import { mount, createLocalVue as CreateLocalVue } from '@vue/test-utils'

const localVue = new CreateLocalVue()

const waitAF = () => new Promise(resolve => requestAnimationFrame(resolve))

// Our test application definition
const appDef = {
  props: ['triggers', 'show', 'disabled', 'noFade', 'title', 'titleAttr', 'btnDisabled'],
  render(h) {
    return h('article', { attrs: { id: 'wrapper' } }, [
      h(
        'button',
        {
          attrs: {
            id: 'foo',
            type: 'button',
            disabled: this.btnDisabled || null,
            title: this.titleAttr || null
          }
        },
        'text'
      ),
      h(
        Tooltip,
        {
          attrs: { id: 'bar' },
          props: {
            target: 'foo',
            triggers: this.triggers,
            show: this.show,
            disabled: this.disabled,
            noFade: this.noFade || false,
            title: this.title || null
          }
        },
        this.$slots.default || ''
      )
    ])
  }
}

//
// Note:
// wrapper.destroy() **MUST** be called at the end of each test in order for
// the next test to function properly!
//
describe('tooltip', () => {
  const originalCreateRange = document.createRange
  const origGetBCR = Element.prototype.getBoundingClientRect

  beforeEach(() => {
    // https://github.com/FezVrasta/popper.js/issues/478#issuecomment-407422016
    // Hack to make Popper not bork out during tests.
    // Note popper still does not do any positioning calculation in JSDOM though.
    // So we cannot test actual positioning... just detect when it is open.
    document.createRange = () => ({
      setStart: () => {},
      setEnd: () => {},
      commonAncestorContainer: {
        nodeName: 'BODY',
        ownerDocument: document
      }
    })
    // Mock getBCR so that the isVisible(el) test returns true
    // Needed for visibility checks of trigger element, etc.
    Element.prototype.getBoundingClientRect = jest.fn(() => {
      return {
        width: 24,
        height: 24,
        top: 0,
        left: 0,
        bottom: 0,
        right: 0
      }
    })
  })

  afterEach(() => {
    // Reset overrides
    document.createRange = originalCreateRange
    Element.prototype.getBoundingClientRect = origGetBCR
  })

  it('has expected default structure', async () => {
    const App = localVue.extend(appDef)
    const wrapper = mount(App, {
      attachToDocument: true,
      localVue: localVue,
      propsData: {
        triggers: 'click'
      },
      slots: {
        default: 'title'
      }
    })

    expect(wrapper.isVueInstance()).toBe(true)
    await wrapper.vm.$nextTick()

    expect(wrapper.is('article')).toBe(true)
    expect(wrapper.attributes('id')).toBeDefined()
    expect(wrapper.attributes('id')).toEqual('wrapper')

    // The trigger button
    const $button = wrapper.find('button')
    expect($button.exists()).toBe(true)
    expect($button.attributes('id')).toBeDefined()
    expect($button.attributes('id')).toEqual('foo')
    expect($button.attributes('title')).toBeDefined()
    expect($button.attributes('title')).toEqual('')
    expect($button.attributes('data-original-title')).toBeDefined()
    expect($button.attributes('data-original-title')).toEqual('')
    expect($button.attributes('aria-describedby')).not.toBeDefined()

    // b-tooltip wrapper
    const $tipholder = wrapper.find('div#bar')
    expect($tipholder.exists()).toBe(true)
    expect($tipholder.classes()).toContain('d-none')
    expect($tipholder.attributes('aria-hidden')).toBeDefined()
    expect($tipholder.attributes('aria-hidden')).toEqual('true')
    expect($tipholder.element.style.display).toEqual('none')

    // title placeholder (from default slot)
    expect($tipholder.findAll('div.d-none > div').length).toBe(1)
    expect($tipholder.find('div.d-none > div').text()).toBe('title')

    wrapper.destroy()
  })

  it('initially open has expected structure', async () => {
    jest.useFakeTimers()
    const App = localVue.extend(appDef)
    const wrapper = mount(App, {
      attachToDocument: true,
      localVue: localVue,
      propsData: {
        triggers: 'click',
        show: true
      },
      slots: {
        default: 'title'
      }
    })

    expect(wrapper.isVueInstance()).toBe(true)
    await wrapper.vm.$nextTick()
    await waitAF()
    await wrapper.vm.$nextTick()
    await waitAF()
    jest.runOnlyPendingTimers()

    expect(wrapper.is('article')).toBe(true)
    expect(wrapper.attributes('id')).toBeDefined()
    expect(wrapper.attributes('id')).toEqual('wrapper')

    // The trigger button
    const $button = wrapper.find('button')
    expect($button.exists()).toBe(true)
    expect($button.attributes('id')).toBeDefined()
    expect($button.attributes('id')).toEqual('foo')
    expect($button.attributes('title')).toBeDefined()
    expect($button.attributes('title')).toEqual('')
    expect($button.attributes('data-original-title')).toBeDefined()
    expect($button.attributes('data-original-title')).toEqual('')
    expect($button.attributes('aria-describedby')).toBeDefined()
    // ID of the tooltip that will be in the body
    const adb = $button.attributes('aria-describedby')

    // b-tooltip wrapper
    const $tipholder = wrapper.find('div#bar')
    expect($tipholder.exists()).toBe(true)
    expect($tipholder.classes()).toContain('d-none')
    expect($tipholder.attributes('aria-hidden')).toBeDefined()
    expect($tipholder.attributes('aria-hidden')).toEqual('true')
    expect($tipholder.element.style.display).toEqual('none')

    // title placeholder (from default slot) will ahve been moved to tooltip element
    expect($tipholder.findAll('div.d-none > div').length).toBe(0)
    // title text will be moved into the tooltip
    expect($tipholder.text()).toBe('')

    // Find the tooltip element in the document
    const tip = document.querySelector(`#${adb}`)
    expect(tip).not.toBe(null)
    expect(tip).toBeInstanceOf(HTMLElement)
    expect(tip.tagName).toEqual('DIV')
    expect(tip.classList.contains('tooltip')).toBe(true)

    // Hide the tooltip
    wrapper.setProps({
      show: false
    })
    await wrapper.vm.$nextTick()
    await waitAF()
    await wrapper.vm.$nextTick()
    await waitAF()
    jest.runOnlyPendingTimers()

    expect($button.attributes('aria-describedby')).not.toBeDefined()
    // title placeholder (from default slot) will be back here
    expect($tipholder.findAll('div.d-none > div').length).toBe(1)
    // title text will be moved into the tooltip
    expect($tipholder.find('div.d-none > div').text()).toBe('title')

    // Tooltip element should not be in the document
    expect(document.body.contains(tip)).toBe(false)
    expect(document.querySelector(`#${adb}`)).toBe(null)

    wrapper.destroy()
  })

  it('activating trigger element (click) opens tooltip', async () => {
    jest.useFakeTimers()
    const App = localVue.extend(appDef)
    const wrapper = mount(App, {
      attachToDocument: true,
      localVue: localVue,
      propsData: {
        triggers: 'click',
        show: false
      },
      slots: {
        default: 'title'
      }
    })

    expect(wrapper.isVueInstance()).toBe(true)
    await wrapper.vm.$nextTick()
    await waitAF()
    await wrapper.vm.$nextTick()
    await waitAF()
    jest.runOnlyPendingTimers()

    expect(wrapper.is('article')).toBe(true)
    expect(wrapper.attributes('id')).toBeDefined()
    expect(wrapper.attributes('id')).toEqual('wrapper')

    // The trigger button
    const $button = wrapper.find('button')
    expect($button.exists()).toBe(true)
    expect($button.attributes('id')).toBeDefined()
    expect($button.attributes('id')).toEqual('foo')
    expect($button.attributes('aria-describedby')).not.toBeDefined()

    // b-tooltip wrapper
    const $tipholder = wrapper.find('div#bar')
    expect($tipholder.exists()).toBe(true)

    // title placeholder will be here until opened
    expect($tipholder.findAll('div.d-none > div').length).toBe(1)
    expect($tipholder.text()).toBe('title')

    // Activate tooltip by trigger
    $button.trigger('click')
    await wrapper.vm.$nextTick()
    await waitAF()
    await wrapper.vm.$nextTick()
    await waitAF()
    jest.runOnlyPendingTimers()

    expect($button.attributes('id')).toBeDefined()
    expect($button.attributes('id')).toEqual('foo')
    expect($button.attributes('aria-describedby')).toBeDefined()
    // ID of the tooltip that will be in the body
    const adb = $button.attributes('aria-describedby')

    // Find the tooltip element in the document
    const tip = document.querySelector(`#${adb}`)
    expect(tip).not.toBe(null)
    expect(tip).toBeInstanceOf(HTMLElement)
    expect(tip.tagName).toEqual('DIV')
    expect(tip.classList.contains('tooltip')).toBe(true)

    wrapper.destroy()

    // Tooltip element should not be in the document
    expect(document.body.contains(tip)).toBe(false)
    expect(document.querySelector(`#${adb}`)).toBe(null)
  })

  it('activating trigger element (focus) opens tooltip', async () => {
    jest.useFakeTimers()
    const App = localVue.extend(appDef)
    const wrapper = mount(App, {
      attachToDocument: true,
      localVue: localVue,
      propsData: {
        triggers: 'focus',
        show: false
      },
      slots: {
        default: 'title'
      }
    })

    expect(wrapper.isVueInstance()).toBe(true)
    await wrapper.vm.$nextTick()
    await waitAF()
    await wrapper.vm.$nextTick()
    await waitAF()
    jest.runOnlyPendingTimers()

    expect(wrapper.is('article')).toBe(true)
    expect(wrapper.attributes('id')).toBeDefined()
    expect(wrapper.attributes('id')).toEqual('wrapper')

    // The trigger button
    const $button = wrapper.find('button')
    expect($button.exists()).toBe(true)
    expect($button.attributes('id')).toBeDefined()
    expect($button.attributes('id')).toEqual('foo')
    expect($button.attributes('aria-describedby')).not.toBeDefined()

    // b-tooltip wrapper
    const $tipholder = wrapper.find('div#bar')
    expect($tipholder.exists()).toBe(true)

    // title placeholder will be here until opened
    expect($tipholder.findAll('div.d-none > div').length).toBe(1)
    expect($tipholder.text()).toBe('title')

    // Activate tooltip by trigger
    $button.trigger('focusin')
    await wrapper.vm.$nextTick()
    await waitAF()
    await wrapper.vm.$nextTick()
    await waitAF()
    jest.runOnlyPendingTimers()
    jest.runOnlyPendingTimers()

    expect($button.attributes('id')).toBeDefined()
    expect($button.attributes('id')).toEqual('foo')
    expect($button.attributes('aria-describedby')).toBeDefined()
    // ID of the tooltip that will be in the body
    const adb = $button.attributes('aria-describedby')

    // Find the tooltip element in the document
    const tip = document.querySelector(`#${adb}`)
    expect(tip).not.toBe(null)
    expect(tip).toBeInstanceOf(HTMLElement)
    expect(tip.tagName).toEqual('DIV')
    expect(tip.classList.contains('tooltip')).toBe(true)

    // Deactivate tooltip by trigger
    $button.trigger('focusout')
    await wrapper.vm.$nextTick()
    await waitAF()
    await wrapper.vm.$nextTick()
    await waitAF()
    jest.runOnlyPendingTimers()
    jest.runOnlyPendingTimers()

    // Tooltip element should not be in the document
    expect($button.attributes('aria-describedby')).not.toBeDefined()
    expect(document.body.contains(tip)).toBe(false)
    expect(document.querySelector(`#${adb}`)).toBe(null)

    wrapper.destroy()
  })

  it('activating trigger element (hover) opens tooltip', async () => {
    jest.useFakeTimers()
    const App = localVue.extend(appDef)
    const wrapper = mount(App, {
      attachToDocument: true,
      localVue: localVue,
      propsData: {
        triggers: 'hover',
        show: false,
        // Add no fade for coverage
        noFade: true
      },
      slots: {
        default: 'title'
      }
    })

    expect(wrapper.isVueInstance()).toBe(true)
    await wrapper.vm.$nextTick()
    await waitAF()
    await wrapper.vm.$nextTick()
    await waitAF()
    jest.runOnlyPendingTimers()

    expect(wrapper.is('article')).toBe(true)
    expect(wrapper.attributes('id')).toBeDefined()
    expect(wrapper.attributes('id')).toEqual('wrapper')

    // The trigger button
    const $button = wrapper.find('button')
    expect($button.exists()).toBe(true)
    expect($button.attributes('id')).toBeDefined()
    expect($button.attributes('id')).toEqual('foo')
    expect($button.attributes('aria-describedby')).not.toBeDefined()

    // b-tooltip wrapper
    const $tipholder = wrapper.find('div#bar')
    expect($tipholder.exists()).toBe(true)

    // title placeholder will be here until opened
    expect($tipholder.findAll('div.d-none > div').length).toBe(1)
    expect($tipholder.text()).toBe('title')

    // Activate tooltip by trigger
    $button.trigger('mouseenter')
    await wrapper.vm.$nextTick()
    await waitAF()
    await wrapper.vm.$nextTick()
    await waitAF()
    jest.runOnlyPendingTimers()
    jest.runOnlyPendingTimers()

    expect($button.attributes('id')).toBeDefined()
    expect($button.attributes('id')).toEqual('foo')
    expect($button.attributes('aria-describedby')).toBeDefined()
    // ID of the tooltip that will be in the body
    const adb = $button.attributes('aria-describedby')

    // Find the tooltip element in the document
    const tip = document.querySelector(`#${adb}`)
    expect(tip).not.toBe(null)
    expect(tip).toBeInstanceOf(HTMLElement)
    expect(tip.tagName).toEqual('DIV')
    expect(tip.classList.contains('tooltip')).toBe(true)

    // Deactivate tooltip by trigger
    $button.trigger('mouseleave')
    await wrapper.vm.$nextTick()
    await waitAF()
    await wrapper.vm.$nextTick()
    await waitAF()
    jest.runOnlyPendingTimers()
    jest.runOnlyPendingTimers()

    // Tooltip element should not be in the document
    expect($button.attributes('aria-describedby')).not.toBeDefined()
    expect(document.body.contains(tip)).toBe(false)
    expect(document.querySelector(`#${adb}`)).toBe(null)

    wrapper.destroy()
  })

  it('disabled tooltip does not open on trigger', async () => {
    jest.useFakeTimers()
    const App = localVue.extend(appDef)
    const wrapper = mount(App, {
      attachToDocument: true,
      localVue: localVue,
      propsData: {
        triggers: 'click',
        show: false,
        disabled: true
      },
      slots: {
        default: 'title'
      }
    })

    expect(wrapper.isVueInstance()).toBe(true)
    await wrapper.vm.$nextTick()
    await waitAF()
    await wrapper.vm.$nextTick()
    await waitAF()
    jest.runOnlyPendingTimers()

    expect(wrapper.is('article')).toBe(true)
    expect(wrapper.attributes('id')).toBeDefined()
    expect(wrapper.attributes('id')).toEqual('wrapper')

    // The trigger button
    const $button = wrapper.find('button')
    expect($button.exists()).toBe(true)
    expect($button.attributes('id')).toBeDefined()
    expect($button.attributes('id')).toEqual('foo')
    expect($button.attributes('aria-describedby')).not.toBeDefined()

    // b-tooltip wrapper
    const $tipholder = wrapper.find('div#bar')
    expect($tipholder.exists()).toBe(true)

    // title placeholder will be here until opened
    expect($tipholder.findAll('div.d-none > div').length).toBe(1)
    expect($tipholder.text()).toBe('title')

    // Try to activate tooltip by trigger
    $button.trigger('click')
    await wrapper.vm.$nextTick()
    await waitAF()
    await wrapper.vm.$nextTick()
    await waitAF()
    jest.runOnlyPendingTimers()

    // Tooltip should not have opened
    expect($button.attributes('aria-describedby')).not.toBeDefined()
    expect($tipholder.findAll('div.d-none > div').length).toBe(1)
    expect($tipholder.text()).toBe('title')

    // Now enabled the tooltip
    wrapper.setProps({
      disabled: false
    })
    await wrapper.vm.$nextTick()
    await waitAF()
    await wrapper.vm.$nextTick()
    await waitAF()
    jest.runOnlyPendingTimers()

    // Try to activate tooltip by trigger
    $button.trigger('click')
    await wrapper.vm.$nextTick()
    await waitAF()
    await wrapper.vm.$nextTick()
    await waitAF()
    jest.runOnlyPendingTimers()
    jest.runOnlyPendingTimers()

    expect($button.attributes('aria-describedby')).toBeDefined()
    // expect($tipholder.findAll('div.d-none > div').length).toBe(0)
    const adb = $button.attributes('aria-describedby')

    // Find the tooltip element in the document
    const tip = document.querySelector(`#${adb}`)
    expect(tip).not.toBe(null)
    expect(tip).toBeInstanceOf(HTMLElement)
    expect(tip.tagName).toEqual('DIV')
    expect(tip.classList.contains('tooltip')).toBe(true)

    wrapper.destroy()
  })

  it('closes on $root close specific ID event', async () => {
    jest.useFakeTimers()
    const App = localVue.extend(appDef)
    const wrapper = mount(App, {
      attachToDocument: true,
      localVue: localVue,
      propsData: {
        triggers: 'click',
        show: true,
        disabled: false,
        titleAttr: 'ignored'
      },
      slots: {
        default: 'title'
      }
    })

    expect(wrapper.isVueInstance()).toBe(true)
    await wrapper.vm.$nextTick()
    await waitAF()
    await wrapper.vm.$nextTick()
    await waitAF()
    jest.runOnlyPendingTimers()

    expect(wrapper.is('article')).toBe(true)
    expect(wrapper.attributes('id')).toBeDefined()
    expect(wrapper.attributes('id')).toEqual('wrapper')

    // The trigger button
    const $button = wrapper.find('button')
    expect($button.exists()).toBe(true)
    expect($button.attributes('id')).toBeDefined()
    expect($button.attributes('id')).toEqual('foo')
    expect($button.attributes('title')).toBeDefined()
    expect($button.attributes('title')).toEqual('')
    expect($button.attributes('data-original-title')).toBeDefined()
    expect($button.attributes('data-original-title')).toEqual('ignored')
    expect($button.attributes('aria-describedby')).toBeDefined()
    // ID of the tooltip that will be in the body
    const adb = $button.attributes('aria-describedby')

    // b-tooltip wrapper
    const $tipholder = wrapper.find('div#bar')
    expect($tipholder.exists()).toBe(true)
    expect($tipholder.classes()).toContain('d-none')
    expect($tipholder.attributes('aria-hidden')).toBeDefined()
    expect($tipholder.attributes('aria-hidden')).toEqual('true')
    expect($tipholder.element.style.display).toEqual('none')

    // title placeholder...
    expect($tipholder.text()).toBe('')

    // Find the tooltip element in the document
    const tip = document.querySelector(`#${adb}`)
    expect(tip).not.toBe(null)
    expect(tip).toBeInstanceOf(HTMLElement)
    expect(tip.tagName).toEqual('DIV')
    expect(tip.classList.contains('tooltip')).toBe(true)

    // Hide the tooltip by emitting root event with correct ID (forceHide)
    wrapper.vm.$root.$emit('bv::hide::tooltip', 'foo')
    await wrapper.vm.$nextTick()
    await waitAF()
    await wrapper.vm.$nextTick()
    await waitAF()
    jest.runOnlyPendingTimers()
    jest.runOnlyPendingTimers()

    expect($button.attributes('aria-describedby')).not.toBeDefined()

    // Tooltip element should not be in the document
    expect(document.body.contains(tip)).toBe(false)
    expect(document.querySelector(`#${adb}`)).toBe(null)

    wrapper.destroy()
  })

  it('does not close on $root close specific other ID event', async () => {
    jest.useFakeTimers()
    const App = localVue.extend(appDef)
    const wrapper = mount(App, {
      attachToDocument: true,
      localVue: localVue,
      propsData: {
        triggers: 'click',
        show: true,
        disabled: false,
        titleAttr: 'ignored'
      },
      slots: {
        default: 'title'
      }
    })

    expect(wrapper.isVueInstance()).toBe(true)
    await wrapper.vm.$nextTick()
    await waitAF()
    await wrapper.vm.$nextTick()
    await waitAF()
    jest.runOnlyPendingTimers()

    expect(wrapper.is('article')).toBe(true)
    expect(wrapper.attributes('id')).toBeDefined()
    expect(wrapper.attributes('id')).toEqual('wrapper')

    // The trigger button
    const $button = wrapper.find('button')
    expect($button.exists()).toBe(true)
    expect($button.attributes('id')).toBeDefined()
    expect($button.attributes('id')).toEqual('foo')
    expect($button.attributes('title')).toBeDefined()
    expect($button.attributes('title')).toEqual('')
    expect($button.attributes('data-original-title')).toBeDefined()
    expect($button.attributes('data-original-title')).toEqual('ignored')
    expect($button.attributes('aria-describedby')).toBeDefined()
    // ID of the tooltip that will be in the body
    const adb = $button.attributes('aria-describedby')

    // b-tooltip wrapper
    const $tipholder = wrapper.find('div#bar')
    expect($tipholder.exists()).toBe(true)
    expect($tipholder.classes()).toContain('d-none')
    expect($tipholder.attributes('aria-hidden')).toBeDefined()
    expect($tipholder.attributes('aria-hidden')).toEqual('true')
    expect($tipholder.element.style.display).toEqual('none')

    // title placeholder...
    expect($tipholder.text()).toBe('')

    // Find the tooltip element in the document
    const tip = document.querySelector(`#${adb}`)
    expect(tip).not.toBe(null)
    expect(tip).toBeInstanceOf(HTMLElement)
    expect(tip.tagName).toEqual('DIV')
    expect(tip.classList.contains('tooltip')).toBe(true)

    // Tooltip should ignore when ID is not it's own
    wrapper.vm.$root.$emit('bv::hide::tooltip', 'wrong-id')
    await wrapper.vm.$nextTick()
    await waitAF()
    await wrapper.vm.$nextTick()
    await waitAF()
    jest.runOnlyPendingTimers()
    jest.runOnlyPendingTimers()

    expect($button.attributes('aria-describedby')).toBeDefined()

    // Tooltip element should not be in the document
    expect(document.body.contains(tip)).toBe(true)
    expect(document.querySelector(`#${adb}`)).not.toBe(null)

    wrapper.destroy()
  })

  it('closes on $root close all event', async () => {
    jest.useFakeTimers()
    const App = localVue.extend(appDef)
    const wrapper = mount(App, {
      attachToDocument: true,
      localVue: localVue,
      propsData: {
        triggers: 'click',
        show: true,
        disabled: false,
        titleAttr: 'ignored'
      },
      slots: {
        default: 'title'
      }
    })

    expect(wrapper.isVueInstance()).toBe(true)
    await wrapper.vm.$nextTick()
    await waitAF()
    await wrapper.vm.$nextTick()
    await waitAF()
    jest.runOnlyPendingTimers()

    expect(wrapper.is('article')).toBe(true)
    expect(wrapper.attributes('id')).toBeDefined()
    expect(wrapper.attributes('id')).toEqual('wrapper')

    // The trigger button
    const $button = wrapper.find('button')
    expect($button.exists()).toBe(true)
    expect($button.attributes('id')).toBeDefined()
    expect($button.attributes('id')).toEqual('foo')
    expect($button.attributes('title')).toBeDefined()
    expect($button.attributes('title')).toEqual('')
    expect($button.attributes('data-original-title')).toBeDefined()
    expect($button.attributes('data-original-title')).toEqual('ignored')
    expect($button.attributes('aria-describedby')).toBeDefined()
    // ID of the tooltip that will be in the body
    const adb = $button.attributes('aria-describedby')

    // b-tooltip wrapper
    const $tipholder = wrapper.find('div#bar')
    expect($tipholder.exists()).toBe(true)
    expect($tipholder.classes()).toContain('d-none')
    expect($tipholder.attributes('aria-hidden')).toBeDefined()
    expect($tipholder.attributes('aria-hidden')).toEqual('true')
    expect($tipholder.element.style.display).toEqual('none')

    // title placeholder...
    expect($tipholder.text()).toBe('')

    // Find the tooltip element in the document
    const tip = document.querySelector(`#${adb}`)
    expect(tip).not.toBe(null)
    expect(tip).toBeInstanceOf(HTMLElement)
    expect(tip.tagName).toEqual('DIV')
    expect(tip.classList.contains('tooltip')).toBe(true)

    // Hide the tooltip by emitting root event with no ID (forceHide)
    wrapper.vm.$root.$emit('bv::hide::tooltip')
    await wrapper.vm.$nextTick()
    await waitAF()
    await wrapper.vm.$nextTick()
    await waitAF()
    jest.runOnlyPendingTimers()
    jest.runOnlyPendingTimers()

    expect($button.attributes('aria-describedby')).not.toBeDefined()

    // Tooltip element should not be in the document
    expect(document.body.contains(tip)).toBe(false)
    expect(document.querySelector(`#${adb}`)).toBe(null)

    wrapper.destroy()
  })

  it('closes when trigger element is no longer visible', async () => {
    jest.useFakeTimers()
    const App = localVue.extend(appDef)
    const wrapper = mount(App, {
      attachToDocument: true,
      localVue: localVue,
      propsData: {
        triggers: 'click',
        show: true,
        disabled: false
      },
      slots: {
        default: 'title'
      }
    })

    expect(wrapper.isVueInstance()).toBe(true)
    await wrapper.vm.$nextTick()
    await waitAF()
    await wrapper.vm.$nextTick()
    await waitAF()
    jest.runOnlyPendingTimers()

    expect(wrapper.is('article')).toBe(true)
    expect(wrapper.attributes('id')).toBeDefined()
    expect(wrapper.attributes('id')).toEqual('wrapper')

    // The trigger button
    const $button = wrapper.find('button')
    expect($button.exists()).toBe(true)
    expect($button.attributes('id')).toBeDefined()
    expect($button.attributes('id')).toEqual('foo')
    expect($button.attributes('title')).toBeDefined()
    expect($button.attributes('data-original-title')).toBeDefined()
    expect($button.attributes('aria-describedby')).toBeDefined()
    // ID of the tooltip that will be in the body
    const adb = $button.attributes('aria-describedby')

    // b-tooltip wrapper
    const $tipholder = wrapper.find('div#bar')
    expect($tipholder.exists()).toBe(true)
    expect($tipholder.classes()).toContain('d-none')
    expect($tipholder.attributes('aria-hidden')).toBeDefined()
    expect($tipholder.attributes('aria-hidden')).toEqual('true')
    expect($tipholder.element.style.display).toEqual('none')

    // title placeholder...
    expect($tipholder.text()).toBe('')

    // Find the tooltip element in the document
    const tip = document.querySelector(`#${adb}`)
    expect(tip).not.toBe(null)
    expect(tip).toBeInstanceOf(HTMLElement)
    expect(tip.tagName).toEqual('DIV')
    expect(tip.classList.contains('tooltip')).toBe(true)

    // Hide the tooltip by removing the trigger button from DOM
    $button.element.parentNode.removeChild($button.element)
    await wrapper.vm.$nextTick()
    await waitAF()
    await wrapper.vm.$nextTick()
    await waitAF()
    // The visibility check runs on an intetrval of 100ms
    jest.runOnlyPendingTimers()
    jest.runOnlyPendingTimers()

    expect($button.attributes('aria-describedby')).not.toBeDefined()

    // Tooltip element should not be in the document
    expect(document.body.contains(tip)).toBe(false)
    expect(document.querySelector(`#${adb}`)).toBe(null)

    // Try and show element via root event (using ID of trigger button)
    wrapper.vm.$root.$emit('bv::show::tooltip', 'foo')
    await wrapper.vm.$nextTick()
    await waitAF()
    await wrapper.vm.$nextTick()
    await waitAF()
    jest.runOnlyPendingTimers()

    // Tooltip element should not be in the document
    expect(document.querySelector(`#${adb}`)).toBe(null)

    // Try and show element via root event (using show all)
    wrapper.vm.$root.$emit('bv::show::tooltip')
    await wrapper.vm.$nextTick()
    await waitAF()
    await wrapper.vm.$nextTick()
    await waitAF()
    jest.runOnlyPendingTimers()

    // Tooltip element should not be in the document
    expect(document.querySelector(`#${adb}`)).toBe(null)

    wrapper.destroy()
  })
})
