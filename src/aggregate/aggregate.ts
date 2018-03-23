import { Action } from '@ngrx/store';
import { OperatorFunction } from 'rxjs/interfaces';
import { Observable } from 'rxjs/Observable';
import { forkJoin } from 'rxjs/observable/forkJoin';
import { race } from 'rxjs/observable/race';
import { _throw as throwError } from 'rxjs/observable/throw';
import { filter, first, switchMap } from 'rxjs/operators';

export type AggregatableAction = Action & { correlationParams?: CorrelationParams };
export type FailActionForAggregation = Action & { error?: Error, correlationParams?: CorrelationParams };
export type CorrelationParams = { correlationId?: string, parentActionType?: string };

export function aggregate<T extends AggregatableAction,
    TAction1 extends AggregatableAction,
    TAction2 extends AggregatableAction,
    TFailAction extends FailActionForAggregation>
(
    action1$: Observable<TAction1>,
    action2$: Observable<TAction2>,
    failAction$: Observable<TFailAction>
): OperatorFunction<T, [TAction1, TAction2]> {

    const filterAction = (sourceAction: AggregatableAction, t: AggregatableAction) =>
        t.correlationParams && sourceAction.correlationParams &&
        t.correlationParams.correlationId === sourceAction.correlationParams.correlationId &&
        t.correlationParams.parentActionType === sourceAction.type;

    const getAggregatedActions = (sourceAction: AggregatableAction): Observable<[TAction1, TAction2]> => {
        let a1$ = action1$
            .pipe(
                filter(a => {
                    return filterAction(sourceAction, a);
                }),
                first()
            );
        let a2$ = action2$
            .pipe(
                filter(a => {
                    return filterAction(sourceAction, a);
                }),
                first()
            );

        let f$ = failAction$
            .pipe(
                filter(a => {
                    return filterAction(sourceAction, a);
                }),
                first(),
                switchMap(b => {
                    return throwError(b.error);
                })
            );

        return race(forkJoin([a1$, a2$]), f$);
    };

    return (source: Observable<AggregatableAction>) => source.pipe(
        switchMap(sourceAction => getAggregatedActions(sourceAction))
    );
}
