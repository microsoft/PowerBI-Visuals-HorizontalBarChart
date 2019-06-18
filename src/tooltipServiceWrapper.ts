import powerbi from "powerbi-visuals-api";

import { ContainerElement, event, select, Selection, touches } from "d3-selection";

import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;
import ISelectionId = powerbi.extensibility.ISelectionId;
import ITooltipService = powerbi.extensibility.ITooltipService;

export interface ITooltipEventArgs<TData> {
    data: TData;
    coordinates: number[];
    elementCoordinates: number[];
    context: HTMLElement;
    isTouchEvent: boolean;
}

export interface ITooltipServiceWrapper {
    addTooltip<T>(
        selection: Selection<Element, any, any, any>,
        getTooltipInfoDelegate: (args: ITooltipEventArgs<T>) => VisualTooltipDataItem[],
        getDataPointIdentity: (args: ITooltipEventArgs<T>) => ISelectionId,
        reloadTooltipDataOnMouseMove?: boolean): void;
    hide(): void;
}

const DefaultHandleTouchDelay = 1000;

export function createTooltipServiceWrapper(
    tooltipService: ITooltipService,
    rootElement: ContainerElement,
    handleTouchDelay: number = DefaultHandleTouchDelay): ITooltipServiceWrapper {
    return new TooltipServiceWrapper(tooltipService, rootElement, handleTouchDelay);
}

class TooltipServiceWrapper implements ITooltipServiceWrapper {

    private static touchStartEventName(): string {
        let eventName: string = "touchstart";
        let pointerEvent = "PointerEvent";
        if (window[pointerEvent]) {
            // IE11
            eventName = "pointerdown";
        }

        return eventName;
    }

    private static touchMoveEventName(): string {
        let eventName: string = "touchmove";
        let pointerEvent = "PointerEvent";
        if (window[pointerEvent]) {
            // IE11
            eventName = "pointermove";
        }

        return eventName;
    }

    private static touchEndEventName(): string {
        let eventName: string = "touchend";
        let pointerEvent = "PointerEvent";
        if (window[pointerEvent]) {
            // IE11
            eventName = "pointerup";
        }

        return eventName;
    }

    private static usePointerEvents(): boolean {
        let eventName = TooltipServiceWrapper.touchStartEventName();
        return eventName === "pointerdown" || eventName === "MSPointerDown";
    }

    private handleTouchTimeoutId: number;
    private visualHostTooltipService: ITooltipService;
    private rootElement: ContainerElement;
    private handleTouchDelay: number;

    constructor(tooltipService: ITooltipService, rootElement: ContainerElement, handleTouchDelay: number) {
        this.visualHostTooltipService = tooltipService;
        this.handleTouchDelay = handleTouchDelay;
        this.rootElement = rootElement;
    }
    public addTooltip<T>(
        selection: d3.Selection<Element, any, any, any>,
        getTooltipInfoDelegate: (args: ITooltipEventArgs<T>) => VisualTooltipDataItem[],
        getDataPointIdentity: (args: ITooltipEventArgs<T>) => ISelectionId,
        reloadTooltipDataOnMouseMove?: boolean): void {

        if (!selection || !this.visualHostTooltipService.enabled()) {
            return;
        }

        let rootNode = this.rootElement;

        // Mouse events
        selection.on("mouseover.tooltip", () => {
            // Ignore mouseover while handling touch events
            if (!this.canDisplayTooltip(event)) {
                return;
            }

            let tooltipEventArgs = this.makeTooltipEventArgs<T>(rootNode, true, false);
            if (!tooltipEventArgs) { return; }

            let tooltipInfo = getTooltipInfoDelegate(tooltipEventArgs);
            if (tooltipInfo == null) { return; }

            let selectionId = getDataPointIdentity(tooltipEventArgs);

            this.visualHostTooltipService.show({
                coordinates: tooltipEventArgs.coordinates,
                dataItems: tooltipInfo,
                identities: selectionId ? [selectionId] : [],
                isTouchEvent: false,
            });
        });

        selection.on("mouseout.tooltip", () => {
            this.visualHostTooltipService.hide({
                immediately: false,
                isTouchEvent: false,
            });
        });

        selection.on("mousemove.tooltip", () => {
            // Ignore mousemove while handling touch events
            if (!this.canDisplayTooltip(event)) { return; }

            let tooltipEventArgs = this.makeTooltipEventArgs<T>(rootNode, true, false);
            if (!tooltipEventArgs) { return; }

            let tooltipInfo: VisualTooltipDataItem[];
            if (reloadTooltipDataOnMouseMove) {
                tooltipInfo = getTooltipInfoDelegate(tooltipEventArgs);
                if (tooltipInfo == null) { return; }
            }

            let selectionId = getDataPointIdentity(tooltipEventArgs);

            this.visualHostTooltipService.move({
                coordinates: tooltipEventArgs.coordinates,
                dataItems: tooltipInfo,
                identities: selectionId ? [selectionId] : [],
                isTouchEvent: false,
            });
        });

        // --- Touch events ---

        let touchStartEventName: string = TooltipServiceWrapper.touchStartEventName();
        let touchEndEventName: string = TooltipServiceWrapper.touchEndEventName();
        let isPointerEvent: boolean = TooltipServiceWrapper.usePointerEvents();

        selection.on(touchStartEventName + ".tooltip", () => {
            this.visualHostTooltipService.hide({
                immediately: true,
                isTouchEvent: true,
            });

            let tooltipEventArgs = this.makeTooltipEventArgs<T>(rootNode, isPointerEvent, true);
            if (!tooltipEventArgs) {
                return;
            }
            let tooltipInfo = getTooltipInfoDelegate(tooltipEventArgs);
            let selectionId = getDataPointIdentity(tooltipEventArgs);

            this.visualHostTooltipService.show({
                coordinates: tooltipEventArgs.coordinates,
                dataItems: tooltipInfo,
                identities: selectionId ? [selectionId] : [],
                isTouchEvent: true,
            });
        });

        selection.on(touchEndEventName + ".tooltip", () => {
            this.visualHostTooltipService.hide({
                immediately: false,
                isTouchEvent: true,
            });

            if (this.handleTouchTimeoutId) {
                clearTimeout(this.handleTouchTimeoutId);
            }

            // At the end of touch action, set a timeout that will let us ignore
            // the incoming mouse events for a small amount of time
            // TODO: any better way to do this?
            this.handleTouchTimeoutId = setTimeout(() => {
                this.handleTouchTimeoutId = undefined;
            }, this.handleTouchDelay);
        });
    }

    public hide(): void {
        this.visualHostTooltipService.hide({ immediately: true, isTouchEvent: false });
    }

    private makeTooltipEventArgs<T>(
        rootNode: ContainerElement,
        isPointerEvent: boolean,
        isTouchEvent: boolean): ITooltipEventArgs<T> {
        let target = <HTMLElement> (<Event> event).target;
        let data: T = select<HTMLElement, T>(target).datum();

        let mouseCoordinates = this.getCoordinates(rootNode, isPointerEvent);
        let elementCoordinates: number[] = this.getCoordinates(target, isPointerEvent);
        let tooltipEventArgs: ITooltipEventArgs<T> = {
            context: target,
            coordinates: mouseCoordinates,
            data,
            elementCoordinates,
            isTouchEvent,
        };

        return tooltipEventArgs;
    }

    private canDisplayTooltip(d3Event: any): boolean {
        let canDisplay: boolean = true;
        let mouseEvent: MouseEvent = <MouseEvent> d3Event;
        if (mouseEvent.buttons !== undefined) {
            // Check mouse buttons state
            let hasMouseButtonPressed = mouseEvent.buttons !== 0;
            canDisplay = !hasMouseButtonPressed;
        }

        // Make sure we are not ignoring mouse events immediately after touch end.
        canDisplay = canDisplay && (this.handleTouchTimeoutId == null);

        return canDisplay;
    }

    private getCoordinates(rootNode: ContainerElement, isPointerEvent: boolean): number[] {
        let coordinates: number[];

        if (isPointerEvent) {
            // DO NOT USE - WebKit bug in getScreenCTM with nested SVG results in slight negative coordinate shift
            // Also, IE will incorporate transform scale but WebKit does not, forcing us to
            // detect browser and adjust appropriately.
            // Just use non-scaled coordinates for all browsers, and adjust for the
            // transform scale later (see lineChart.findIndex)
            // coordinates = d3.mouse(rootNode);

            // copied from d3_eventSource (which is not exposed)
            let e = <any> event;
            let s: any;
            while (s === e.sourceEvent) {
                e = s;
            }

            let rect = rootNode.getBoundingClientRect();
            coordinates = [e.clientX - rect.left - rootNode.clientLeft, e.clientY - rect.top - rootNode.clientTop];
        } else {
            let touchCoordinates = touches(rootNode);
            if (touchCoordinates && touchCoordinates.length > 0) {
                coordinates = touchCoordinates[0];
            }
        }

        return coordinates;
    }

}
