import type { AgentStepSpec } from './agent'
import type { BaseStepSpec, BranchStepSpec, CustomStepSpec, Json } from './types'

class StepsBuilder<
  TInput extends Record<string, Json> = Record<string, Json>,
  TOutput extends Record<string, Json> = Record<string, Json>,
> {
  readonly #steps: BaseStepSpec[] = []

  public build(): BaseStepSpec<TInput, TOutput> {
    if (this.#steps.length === 0) {
      throw new Error('A workflow must have at least one step.')
    }

    const rootStep =
      this.#steps.length > 1
        ? {
            id: 'root',
            type: 'sequential',
            steps: this.#steps,
          }
        : this.#steps[0]

    return rootStep as BaseStepSpec<TInput, TOutput>
  }

  public step<TStepOutput extends Record<string, Json>, TStepSpec extends BaseStepSpec<TOutput, TStepOutput>>(
    step: TStepSpec,
  ): StepsBuilder<TInput, TStepOutput> {
    this.#steps.push(step)
    return this as unknown as StepsBuilder<TInput, TStepOutput>
  }

  public parallel<TStepOutput extends Record<string, Json>>(
    id: string,
    step: BaseStepSpec<TOutput, TStepOutput>,
  ): StepsBuilder<TInput, TStepOutput> {
    return this.step({
      id,
      type: 'parallel',
      step,
    })
  }

  public custom<TStepOutput extends Record<string, Json>>(spec: CustomStepSpec<TOutput, TStepOutput>): StepsBuilder<TInput, TStepOutput>
  public custom<TStepOutput extends Record<string, Json>>(
    id: string,
    run: CustomStepSpec<TOutput, TStepOutput>['run'],
  ): StepsBuilder<TInput, TStepOutput>
  public custom<TStepOutput extends Record<string, Json>>(
    idOrSpec: string | CustomStepSpec<TOutput, TStepOutput>,
    run?: CustomStepSpec<TOutput, TStepOutput>['run'],
  ): StepsBuilder<TInput, TStepOutput> {
    if (typeof idOrSpec === 'string') {
      if (!run) {
        throw new Error('Custom step "run" function must be provided.')
      }
      return this.step({
        id: idOrSpec,
        type: 'custom',
        run,
      })
    }
    return this.step(idOrSpec)
  }

  public agent<TStepOutput extends Record<string, Json>>(
    id: string,
    spec: Omit<AgentStepSpec<TOutput, TStepOutput>, 'id' | 'type'>,
  ): StepsBuilder<TInput, TStepOutput> {
    return this.step({
      ...spec,
      id,
      type: 'agent',
    })
  }

  public branch<TStepOutput extends Record<string, Json>>(
    id: string,
    config: Omit<BranchStepSpec<TOutput, TStepOutput>, 'id' | 'type'>,
  ): StepsBuilder<TInput, TStepOutput> {
    return this.step({
      ...config,
      id,
      type: 'branch',
    })
  }
}

export const builder = <TInput extends Record<string, Json>>(): StepsBuilder<TInput, TInput> => {
  return new StepsBuilder()
}
