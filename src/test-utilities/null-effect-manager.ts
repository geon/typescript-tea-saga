import { Cmd, Dispatch, EffectManager, Sub } from "@typescript-tea/core";

const home = "null";

export type MyCmd<A> = Echo<A>;

export type Echo<Action> = {
    readonly home: typeof home;
    readonly type: "Echo";
    readonly action: Action;
};

export function echo<Action>(action: Action): MyCmd<Action> {
    return {
        home,
        type: "Echo",
        action,
    };
}

type SelfAction = undefined;
type State<_Action> = undefined;
type MySub<_Action> = {
    readonly home: typeof home;
    readonly type: "unused";
};

export function mapCmd<A1, A2>(
    actionMapper: (a1: A1) => A2,
    cmd: MyCmd<A1>
): MyCmd<A2> {
    return {
        ...cmd,
        action: actionMapper(cmd.action),
    };
}

export function mapSub<A1, A2>(
    _func: (a1: A1) => A2,
    _sub: MySub<A1>
): MySub<A2> {
    return {
        home,
        type: "unused",
    };
}

function onEffects<ProgramAction>(
    dispatchProgram: Dispatch<ProgramAction>,
    _dispatchSelf: Dispatch<SelfAction>,
    cmds: ReadonlyArray<MyCmd<ProgramAction>>,
    _subs: ReadonlyArray<MySub<ProgramAction>>,
    _state: State<ProgramAction> = undefined
): State<ProgramAction> {
    for (const cmd of cmds) {
        dispatchProgram(cmd.action);
    }
    return undefined;
}

function onSelfAction<AppAction>(
    _dispatchProgram: Dispatch<AppAction>,
    _dispatchSelf: Dispatch<SelfAction>,
    _action: SelfAction,
    _state: State<AppAction> = undefined
): State<AppAction> {
    return undefined;
}

export const createEffectManager = <ProgramAction>(): EffectManager<
    typeof home,
    ProgramAction,
    SelfAction,
    State<ProgramAction>,
    MyCmd<ProgramAction>,
    MySub<ProgramAction>
> => ({
    home,
    mapCmd: mapCmd as unknown as <A1, A2>(
        actionMapper: (a1: A1) => A2,
        cmd: Cmd<A1>
    ) => Cmd<A2>,
    mapSub: mapSub as unknown as <A1, A2>(
        actionMapper: (a1: A1) => A2,
        sub: Sub<A1>
    ) => Sub<A2>,
    onEffects: onEffects<ProgramAction> as unknown as (
        dispatchProgram: Dispatch<ProgramAction>,
        dispatchSelf: Dispatch<SelfAction>,
        cmds: ReadonlyArray<Cmd<ProgramAction>>,
        subs: ReadonlyArray<Sub<ProgramAction>>,
        state: State<ProgramAction>
    ) => State<ProgramAction>,
    onSelfAction,
    setup: () => () => undefined,
});
