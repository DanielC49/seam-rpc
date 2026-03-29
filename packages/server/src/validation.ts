export class ValString implements SeamValueString {
    private _value: string;
    private _isValid: boolean = true;

    constructor(value: string) {
        this._value = value;
    }

    get isValid(): boolean {
        return this._isValid;
    }

    min(value: number): SeamValueString {
        if (this._isValid)
            this._isValid = this._value.length >= value;
        return this;
    }

    max(value: number): SeamValueString {
        if (this._isValid)
            this._isValid = this._value.length <= value;
        return this;
    }

    length(value: number): SeamValueString {
        if (this._isValid)
            this._isValid = this._value.length == value;
        return this;
    }

    startsWith(value: string): SeamValueString {
        if (this._isValid)
            this._isValid = this._value.startsWith(value);
        return this;
    }

    endsWith(value: string): SeamValueString {
         if (this._isValid)
            this._isValid = this._value.endsWith(value);
        return this;
    }

    includes(value: string): SeamValueString {
         if (this._isValid)
            this._isValid = this._value.includes(value);
        return this;
    }

    regex(regExpr: string | RegExp): SeamValueString {
        //  if (this._isValid)
        //     this._isValid = this._value.startsWith(value);
        return this;
    }

    email(): SeamValueString {
        return this;
    }
}

type Val<T> =
    (
        T extends string ?
        SeamValueString :
        T extends number ?
        SeamValueNumber :
        T extends any[] ?
        SeamValueArray<Unpacked<T>> :
        { [K in keyof T]: Val<T[K]> }
    ) & {
        custom(): Val<T>
    };

interface SeamValueString {
    min(value: number): SeamValueString;
    max(value: number): SeamValueString;
    length(value: number): SeamValueString;
    startsWith(value: string): SeamValueString;
    endsWith(value: string): SeamValueString;
    includes(value: string): SeamValueString;
    regex(regExpr: string | RegExp): SeamValueString;
    email(): SeamValueString;
}

interface SeamValueNumber {
    gt(value: number): SeamValueNumber;
    gte(value: number): SeamValueNumber;
    lt(value: number): SeamValueNumber;
    lte(value: number): SeamValueNumber;
    integer(): SeamValueNumber;
}

interface SeamValueArray<T> {
    min(value: number): SeamValueArray<T>;
    max(value: number): SeamValueArray<T>;
    length(value: number): SeamValueArray<T>;
    every(filter: Val<T>): SeamValueArray<T>;
    some(filter: Val<T>): SeamValueArray<T>;
}

type Unpacked<T> = T extends (infer U)[] ? U : T;


interface UserData {
    description?: string;
    metadata: {
        id: number;
    }
}

function createUser(name: Val<string>, age: Val<number>, data: Val<UserData>) {
    name.min(3).max(50);
    age.gte(1).lt(150);
    data.description?.max(250);
}

interface ValidationData {
    [paramName:string]: {
        
    }
}

function validate(data: ValidationData) {

}