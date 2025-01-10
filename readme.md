# Saga for typescript-tea

This library makes it possible to write the update parts of [typescript-tea](https://github.com/typescript-tea/core) as imperative code. That makes it easier to do things that requires multiple steps like loading data that depends on other loaded data, or defining the flow of a user interaction through dialogs and wizards.

The library works as an adapter for generators work with typescript-tea. Each time typescript-tea calls its `update`-function, the generator is ran until it "takes" the next action. Any yielded commands or updates to the state are collected and returned to typescript-tea.

You create the saga with `createSagaInitAndUpdate`. It returns your normal `init`and `update` functions to use with typescript-tea. To the `createSagaInitAndUpdate` function, you pass in 2 props: `init` and `createSaga`.

* The prop `init` is a function that returns an initial state. It can take an argument of any type you like. That argument must then be passed to the returned `init`-function.
* The prop `createSaga` is a generator constructor. It takes an `Api` as it's argument. This object contains a number of useful properties for your sagas.

The logic of the saga is defined by the generator constructor `createSaga`. It has a few rules you must obey.

* It must never return. This is type-checked. You can ensure this by:
    * Having an infinite loop.
    * Throwing an error.
    * `return yield* api.forever(...)`. This api function takes a finite saga and runs it repeatedly, forever.
* You must `yield* api.take(...)` or `yield* api.takeAny()` at least once and in each infinite loop.

## Counter Example

In this example, you can dispatch `"increment"` to increment the counter, or dispatch `"restart"` to reset it to zero.

```ts
type Init = void;
export type State = number;
export type Action = "increment" | "reset";

export const { init, update } = createSagaInitAndUpdate<Init, State, Action>({
    init: () => 0,
    createSaga: function* (api) {
        return yield* api.forever(function* () {
            yield [0];

            for(;;) {
                const { action, state } = yield* api.take(
                    (action) => action === "increment" || action === "restart"
                );
                if (action === "restart") {
                    return;
                }

                yield [state + 1];
            }
        });
    },
});
```

## Data Loading Example

This is the random cat gif example from [the http effect manager](https://github.com/typescript-tea/http), but rewritten as a saga. It would be trivial to make it fetch multiple images, or first fetch the api_key from somewhere else.

```ts
type Init = void;
export type State = number;
export type Action = "MorePlease";

export const { init, update } = createSagaInitAndUpdate<Init, State, Action>({
    init: () => 0,
    createSaga: function* (api) {
        return yield* api.forever(function* () {
            const { action, state } = yield* api.take((action) => action.type === "MorePlease");

            const result =  yield* api.resumeAfterCmd((createAction) => Http.get(
                "https://api.giphy.com/v1/gifs/random?api_key=fynIjQH0KtzG1JeEkZZGT3cTie9KFm1T&tag=cat",
                Http.expectJson(createAction, gifDecoder)
            ));

            switch (result.type) {
                case "Ok":
                    yield [{ type: "Success", url: result.value }, undefined];
                case "Err":
                    yield [{ type: "Failure" }, undefined];
                default:
                    return exhaustiveCheck(result, true);
            }
        });
    },
});
```

## The Api Object

```ts
const takeAny: () => Generator<
    InternalPseudoAction,
    Update<State, Action>,
    Input<State, Action>
>;
```

Wait for any action. `yield* api.takeAny()` returns the next action from typescript-tea, and also the state since you almost always need both. Exactly like the normal `update`-function in typescript-tea.

```ts
const take: <T extends Action>(
    predicate: (action: Action) => action is T
) => Generator<
    InternalPseudoAction,
    Update<State, T>,
    Input<State, Action>
>;
```

Wait for a specific action. `yield* api.take((x) => x === "myAction)` returns the next `"myAction"`-action from typescript-tea, and also the state since you almost always need both. `predicate`is a function that returns true when the action matches what you want. Any other action is ignored. This is a type guard, so the returned value from `yield* api.takeAny(...)` is properly typed.

```ts
const forever: (
    finiteSaga: () => FiniteSaga<State, Action>
) => InfiniteSaga<State, Action>;
```

Since your saga *must* never return, you can use `return yield* api.forever(...)` to ensure that. Or just use an infinite loop, or throw an error.

```ts
const getState: () => Generator<
    InternalPseudoAction,
    State,
    Input<State, Action>
>;
```

Get the current state. Beware that the state might change inside a (generator) function you call, or behind your back if you use concurrent sagas with `api.parallel`. In that case you must get a fresh state to update before you yield it, or you might unintentionally overwrite parts of it.

```ts
const parallel: (
    createSubSagas: ReadonlyArray<() => InfiniteSaga<State, Action>>
) => Generator<
    Output<State, Action> | InternalPseudoAction,
    never,
    Input<State, Action>
>;
```

Use `return yield* api.parallel([...])` to start multiple sagas in parallel. Each of them will be given all the actions passed to the typescript-tea `update`-function from then on.

```ts
const resumeAfterCmd: <Payload>(
    createCommand: (
        createAction: (payload: Payload) => {
            readonly tag: symbol;
            readonly payload: Payload;
        }
    ) => Cmd<Action>
) => Generator<
    Output<State, Action> | InternalPseudoAction,
    Payload,
    Input<State, Action>
>;
```

You can yield commands and "take" the action, just like you would in a normal typescript-tea `update`-function. But it is a lot more convenient to let the saga library handle it with `yield* api.resumeAfterCommand<MyType>((createAction) => ...)`. The command you pass in is type-checked and returned value is typed properly. Just pass the `createAction` function to the command and your generator will be resumed with the proper data. `resumeAfterCommand` is "thread safe", so you can issue the same command in parallel sagas and have each instance receive their own response.
