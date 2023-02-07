/**
 * An ArraySet operates as an array until it reaches a certain size, after which a Set is used
 * instead. In either case, the same methods are used to get, set, remove, and visit the items.
 */
declare class ArraySet<T> {
    private arraySize;
    private nextAvailableArraySlot;
    private array;
    private set;
    /**
     * Get whether this ArraySet has any elements.
     *
     * @returns True if this ArraySet has any elements, false otherwise.
     */
    get isEmpty(): boolean;
    /**
     * Add an item to the ArraySet if it is not already present.
     *
     * @param elem The element to add.
     */
    add(elem: T): boolean;
    /**
     * Remove an item from the ArraySet if it is present.
     *
     * @param elem The element to remove
     */
    remove(elem: T): boolean;
    /**
     * Run a callback for each element in the ArraySet.
     *
     * @param visitor The callback to run for each element.
     */
    visit(visitor: (item: T) => void): void;
}

/**
 * An atom is a reactive pointer to any runtime value.
 * Updating an atom to point to a new value advances the global epoch.
 * It can keep a history of diffs describing how its value has changed.
 *
 * @public
 */
export declare interface Atom<Value, Diff = unknown> extends Parent<Value, Diff> {
    set(value: Value, diff?: Diff): Value;
    update(updater: (value: Value) => Value): Value;
}

/** @public */
export declare function atom<Value, Diff = unknown>(name: string, initialValue: Value, options?: AtomOptions<Value, Diff>): Atom<Value, Diff>;

/** @public */
export declare type AtomOptions<Value, Diff> = {
    historyLength?: number;
    computeDiff?: ComputeDiff<Value, Diff>;
    /**
     * @private
     */
    isEqual?: (a: any, b: any) => boolean;
};

declare type Child = ReactingChild | ComputedChild;

/**
 * A computed value
 *
 * @public
 */
export declare type Computed<Value, Diff = unknown> = Parent<Value, Diff> & ComputedChild;

declare class _Computed<Value, Diff = unknown> implements Computed<Value, Diff> {
    readonly name: string;
    private readonly derive;
    /**
     * The epoch when the reactor last changed.
     *
     * @public
     */
    lastChangedEpoch: number;
    /**
     * The epoch when the reactor was last traversed during a transaction.
     *
     * @public
     */
    lastTraversedEpoch: number;
    /**
     * The epoch when the reactor was last checked.
     *
     * @private
     */
    private lastCheckedEpoch;
    /**
     * An array of parents to which this derivation has been attached.
     *
     * @public
     */
    parents: Parent<any, any>[];
    /**
     * An array of epochs for each parent.
     *
     * @private
     */
    parentEpochs: number[];
    /**
     * An array of children that have been attached to this derivation.
     *
     * @public
     */
    children: ArraySet<Child>;
    /**
     * Whether this derivation is actively listening. A derivation will be actively listening if its
     * children is not empty.
     *
     * @public
     */
    get isActivelyListening(): boolean;
    /**
     * (optional) A buffer that stores a history of diffs for this derivation's value.
     *
     * @public
     */
    historyBuffer?: HistoryBuffer<Diff>;
    /**
     * The state of the derivation. Stores the resulting value, if any, of an initialized derivation.
     *
     * @private
     */
    private state;
    /**
     * A method to compute the diff between two values.
     *
     * @private
     */
    private computeDiff?;
    readonly isEqual: null | ((a: any, b: any) => boolean);
    constructor(name: string, derive: (previousValue: Value | typeof UNINITIALIZED, lastComputedEpoch: number) => Value | WithDiff<Value, Diff>, options?: ComputedOptions<Value, Diff>);
    /**
     * Get the derivation's value without capturing it. Other systems will not know that this was
     * done.
     *
     * @returns The value of the atom.
     * @public
     */
    __unsafe__getWithoutCapture(): Value;
    /**
     * Get the value of the derivation and (maybe) capture its parent.
     *
     * @returns The value of the derivation.
     * @public
     */
    get value(): Value;
    /**
     * Get all diffs since the given epoch.
     *
     * @param epoch The epoch to get diffs since.
     * @returns An array of diffs or a flag to reset the history buffer.
     * @public
     */
    getDiffSince(epoch: number): RESET_VALUE | Diff[];
}

/**
 * A decorator for a derivations.
 *
 * ```ts
 * class Counter {
 *   max = 100
 *   count = atom<number>(0)
 *
 *   ~@computed get remaining() {
 *     return this.max - this.count.value
 *   }
 * }
 * ```
 *
 * @param _target
 * @param key The name of the property.
 * @param descriptor The descriptor of the property.
 *
 * @public
 */
export declare function computed(target: any, key: string, descriptor: PropertyDescriptor): PropertyDescriptor;

/** @public */
export declare function computed<Value, Diff = unknown>(options?: ComputedOptions<Value, Diff>): (target: any, key: string, descriptor: PropertyDescriptor) => PropertyDescriptor;

/** @public */
export declare function computed<Value, Diff = unknown>(name: string, compute: (previousValue: Value | typeof UNINITIALIZED, lastComputedEpoch: number) => Value | WithDiff<Value, Diff>, options?: ComputedOptions<Value, Diff>): Computed<Value, Diff>;

declare interface ComputedChild {
    parents: Parent<any, any>[];
    parentEpochs: number[];
    isActivelyListening: boolean;
    lastTraversedEpoch: number;
}

declare type ComputeDiff<Value, Diff> = (previousValue: Value, currentValue: Value, lastComputedEpoch: number, currentEpoch: number) => Diff | RESET_VALUE;

/** @public */
export declare type ComputedOptions<Value, Diff> = {
    historyLength?: number;
    computeDiff?: ComputeDiff<Value, Diff>;
    isEqual?: (a: any, b: any) => boolean;
};

/** @public */
export declare class EffectScheduler<Result> implements ReactingChild {
    readonly name: string;
    private readonly runEffect;
    private readonly scheduleEffect?;
    isActivelyListening: boolean;
    lastTraversedEpoch: number;
    lastReactedEpoch: number;
    scheduleCount: number;
    parentEpochs: number[];
    parents: Parent<any, any>[];
    constructor(name: string, runEffect: (lastReactedEpoch: number) => Result, scheduleEffect?: ((execute: () => void) => void) | undefined);
    maybeScheduleEffect(): void;
    attach(): void;
    detach(): void;
    execute(): Result;
}

/** @public */
export declare const EMPTY_ARRAY: [];

/**
 * Retrieves the underlying computed instance for a given property created with the `@computed` decorator.
 * ```ts
 * class Counter {
 *   max = 100
 *   count = atom<number>(0)
 *
 *   ~@computed get remaining() {
 *     return this.max - this.count.value
 *   }
 * }
 *
 * const c = new Counter()
 * const remaining = getComputedInstance(c, 'remaining')
 * remaining.value === 100 // true
 * c.count.set(13)
 * remaining.value === 87 // true
 * ```
 *
 * @param obj
 * @param propertyName
 * @public
 */
export declare function getComputedInstance<Obj extends object, Prop extends keyof Obj>(obj: Obj, propertyName: Prop): _Computed<Obj[Prop], unknown> | undefined;

/**
 * A structure that stores diffs between values of an atom.
 *
 * @public
 */
export declare class HistoryBuffer<Diff> {
    private readonly capacity;
    private index;
    buffer: Array<RangeTuple<Diff> | undefined>;
    constructor(capacity: number);
    /**
     * Add a diff to the history buffer.
     *
     * @param lastComputedEpoch The epoch when the diff was computed.
     * @param currentEpoch The current epoch.
     * @param diff (optional) The diff to add, or else a reset value.
     * @public
     */
    pushEntry(lastComputedEpoch: number, currentEpoch: number, diff: Diff | RESET_VALUE): void;
    /**
     * Clear the history buffer.
     *
     * @public
     */
    clear(): void;
    /**
     * Get the diffs since the given epoch.
     *
     * @param epoch The epoch to get diffs since.
     * @returns An array of diffs or a flag to reset the history buffer.
     * @public
     */
    getChangesSince(sinceEpoch: number): RESET_VALUE | Diff[];
}

/** @public */
export declare function isAtom(value: unknown): value is Atom<unknown>;

/** @public */
export declare function isReactiveValue(value: any): value is ReactiveValue<any>;

declare interface Parent<Value, Diff = unknown> extends ReactiveValue<Value, Diff> {
    lastChangedEpoch: number;
    children: ArraySet<Child>;
}

declare type RangeTuple<Diff> = [fromEpoch: number, toEpoch: number, diff: Diff];

/** @public */
export declare function react(name: string, fn: (lastReactedEpoch: number) => any): () => void;

declare interface ReactingChild extends ComputedChild {
    maybeScheduleEffect(): void;
}

/** @public */
export declare interface ReactiveValue<Value, Diff = unknown> {
    name: string;
    readonly value: Value;
    getDiffSince(epoch: number): RESET_VALUE | Diff[];
    __unsafe__getWithoutCapture(): Value;
}

/** @public */
export declare interface Reactor<T = unknown> {
    scheduler: EffectScheduler<T>;
    start(): void;
    stop(): void;
}

/** @public */
export declare function reactor(name: string, fn: (lastReactedEpoch: number) => any, effectScheduler?: (cb: () => any) => void): Reactor;

/** @public */
export declare const RESET_VALUE: unique symbol;

/** @public */
export declare type RESET_VALUE = typeof RESET_VALUE;

/**
 * Runs a function inside the current transaction, or creates a new transaction if there
 * is not already one in progress
 * @param fn
 * @public
 */
export declare function transact<T>(fn: () => T): T;

/**
 * Run a function in a transaction. If the function throws, the transaction is aborted.
 *
 * @param fn The function to run in a transaction, called with a function to roll back the change.
 * @public
 */
export declare function transaction<T>(fn: (rollback: () => void) => T): T;

/** @public */
export declare const UNINITIALIZED: unique symbol;

/** @public */
export declare type UNINITIALIZED = typeof UNINITIALIZED;

/** @public */
export declare function whyAmIRunning(): void;

declare class WithDiff<Value, Diff> {
    value: Value;
    diff: Diff;
    constructor(value: Value, diff: Diff);
}

/**
 * Create a WithDiff instance from a value and a diff.
 *
 * @param value The value.
 * @param diff The diff.
 * @public
 */
export declare function withDiff<Value, Diff>(value: Value, diff: Diff): WithDiff<Value, Diff>;

export { }
