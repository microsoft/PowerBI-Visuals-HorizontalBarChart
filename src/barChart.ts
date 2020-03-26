import powerbi from "powerbi-visuals-api";
import "./../style/visual.less";

import { min } from "d3-array";
import { scaleBand, scaleLinear} from "d3-scale";
import { BaseType, select, Selection } from  "d3-selection";
import {
    formattingService,
    IValueFormatter,
    textMeasurementService,
    TextProperties,
    valueFormatter } from "powerbi-visuals-utils-formattingutils";

import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import ILocalizationManager = powerbi.extensibility.ILocalizationManager;
import ISelectionIdBuilder = powerbi.extensibility.ISelectionIdBuilder;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualObjectInstance = powerbi.VisualObjectInstance;
import VisualObjectInstanceEnumeration = powerbi.VisualObjectInstanceEnumeration;
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;
import IColorPalette = powerbi.extensibility.IColorPalette;
import PrimitiveValue = powerbi.PrimitiveValue;
import Fill = powerbi.Fill;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;

import {
    createTooltipServiceWrapper,
    ITooltipEventArgs,
    ITooltipServiceWrapper,
} from "./tooltipServiceWrapper";

import { getCategoricalObjectValue, getValue } from "./objectEnumerationUtility";

import ISelectionId = powerbi.visuals.ISelectionId;

/**
 * An interface for reporting rendering events
 */
interface IVisualEventService {
	/**
	 * Should be called just before the actual rendering was started.
	 * Usually at the very start of the update method.
	 *
	 * @param options - the visual update options received as update parameter
	 */
    renderingStarted(options: VisualUpdateOptions): void;

	/**
	 * Shoudl be called immediately after finishing successfull rendering.
	 *
	 * @param options - the visual update options received as update parameter
	 */
    renderingFinished(options: VisualUpdateOptions): void;

	/**
	 * Called when rendering failed with optional reason string
	 *
	 * @param options - the visual update options received as update parameter
	 * @param reason - the option failure reason string
	 */
    renderingFailed(options: VisualUpdateOptions, reason?: string): void;
}

/**
 * Interface for BarCharts viewmodel.
 *
 * @interface
 * @property {IBarChartDataPoint[]} dataPoints - Set of data points the visual will render.
 * @property {number} dataMax                 - Maximum data value in the set of data points.
 */
interface IBarChartViewModel {
    dataPoints: IBarChartDataPoint[];
    dataMax: number;
    widthMax: number;
    settings: IBarChartSettings;
};
// interface used by text measurement services
interface ITextProperties {
    text?: string;
    fontFamily: string;
    fontSize: string;
    fontWeight?: string;
    fontStyle?: string;
    whiteSpace?: string;
}
/**
 * Interface for BarChart data points.
 *
 * @interface
 * @property {number} value             - Data value for point.
 * @property {string} category          - Corresponding category of data value.
 * @property {string} color             - Color corresponding to data point.
 * @property {ISelectionId} selectionId - Id assigned to data point for cross filtering
 *                                        and visual interaction.
 */
interface IBarChartDataPoint {
    value: PrimitiveValue;
    formattedValue: string;
    overlapValue: PrimitiveValue;
    formattedOverlapValue: string;
    category: string;
    precision: number;
    tooltip: any;
    color: string;
    selectionId: ISelectionId;
    width: number;
    currTextWidth: number;
    selected: boolean;
};

interface IBarChartSettings {

    generalView: {
        minHeight: number,
        barHeight: number,
        opacity: number,
        barsColor: any,
        overlapColor: any,
        textColor: any,

    };
    fontParams: {
        show: boolean,
        fontSize: number,
    };
    units: {
        tooltipUnits: number,
        decimalPlaces: number,
    };
    showBarLabels: {
        show: boolean,
        textColor: any,
        highlightColor: any,
    };
    alignBarLabels: {
        show: boolean,
    };
    barShape: {
        shape: string,
        labelPosition: string,
        headColor: any,
    };
    barHeight: {
        show: boolean,
        height: number,
    };
    experimental: {
        show: boolean,
        blendMode: string,
    };
    clearFilters: {
        show: boolean,
    };
}

/**
 * Function that converts queried data into a view model that will be used by the visual.
 *
 * @function
 * @param {VisualUpdateOptions} options - Contains references to the size of the container
 *                                        and the dataView which contains all the data
 *                                        the visual had queried.
 * @param {IVisualHost} host            - Contains references to the host which contains services
 */
function visualTransform(options: VisualUpdateOptions, host: IVisualHost): IBarChartViewModel {
    let dataViews = options.dataViews;

    let defaultSettings: IBarChartSettings = {

        alignBarLabels: {
            show: false,
        },
        barHeight: {
            height: 30,
            show: true,
        },
        barShape: {
            headColor: { solid: { color: "#FEA19E" } },
            labelPosition: "Top",
            shape: "Bar",
        },
        clearFilters: {
            show: false,
        },
        experimental: {
            blendMode: "difference",
            show: false,
        },
        fontParams: {
            fontSize: 11,
            show: false,
        },
        generalView: {
            barHeight: 30,
            barsColor: { solid: { color: "turquoise" } },
            minHeight: 250,
            opacity: 100,
            overlapColor: { solid: { color: "#FEA19E" } },
            textColor: { solid: { color: "#000" } },
        },
        showBarLabels: {
            highlightColor: { solid: { color: "#000" } },
            show: true,
            textColor: { solid: { color: "#FFF" } },
        },
        units: {
            decimalPlaces: null,
            tooltipUnits: 0,
        },
    };
    let viewModel: IBarChartViewModel = {
        dataMax: 0,
        dataPoints: [],
        settings: <IBarChartSettings> {},
        widthMax: 0,
    };

    if (!dataViews
        || !dataViews[0]
        || !dataViews[0].categorical
        || !dataViews[0].categorical.categories
        || !dataViews[0].categorical.categories[0].source
        || !dataViews[0].categorical.values) {
        return viewModel;
    }

    let categorical = dataViews[0].categorical;
    let category = categorical.categories[0];
    let dataValue = categorical.values[0];
    let metadata = dataViews[0].metadata;

    let overlapDataValue = [];

    let overlapIndex = getOverlapIndex(metadata);

    if (overlapIndex !== -1) {
        overlapDataValue = getDataValueForOverlapValue(categorical.values, overlapIndex);
    }

    let tooltipData = categorical.values.slice(1, categorical.values.length);

    let valueFormatterForCategories: IValueFormatter = valueFormatter.valueFormatter.create({
        format: valueFormatter.valueFormatter.getFormatStringByColumn(category.source),
        value: dataValue,
        value2: categorical.values[categorical.values.length - 1],
    });

    let IBarChartDataPoints: IBarChartDataPoint[] = [];
    let dataMax: number;
    let lenMax: number = 0;
    let currTextWidth: number = 0;
    let colorPalette: IColorPalette = host.colorPalette;

    let objects = metadata.objects;

    let textProperties: ITextProperties;

    let IBarChartSettings: IBarChartSettings = {
        alignBarLabels: {
            show: getValue<boolean> (objects, "alignBarLabels", "show",
                defaultSettings.alignBarLabels.show),
        },
        barHeight: {
            height: getValue<number> (objects, "barHeight", "height",
                defaultSettings.barHeight.height),
            show: getValue<boolean> (objects, "barHeight", "show",
                defaultSettings.barHeight.show),
        },
        barShape: {
            headColor: getValue<string> (objects, "barShape", "headColor",
                defaultSettings.barShape.headColor),
            labelPosition: getValue<string> (objects, "barShape", "labelPosition",
                defaultSettings.barShape.labelPosition),
            shape: getValue<string> (objects, "barShape", "shape",
                defaultSettings.barShape.shape),
        },
        clearFilters: {
            show: getValue<boolean> (objects, "clearFilters", "show",
                defaultSettings.clearFilters.show),
        },
        experimental: {
            blendMode: getValue<string> (objects, "experimental", "blendMode",
                defaultSettings.experimental.blendMode),
            show: getValue<boolean> (objects, "experimental", "show",
                defaultSettings.experimental.show),
        },
        fontParams: {
            fontSize: getValue<number> (objects, "fontParams", "fontSize",
                defaultSettings.fontParams.fontSize),
            show: getValue<boolean> (objects, "fontParams", "show",
                defaultSettings.fontParams.show),
        },
        generalView: {
            barHeight: getValue<number> (objects, "generalView", "barHeight", defaultSettings.generalView.barHeight),
            barsColor: getValue<string> (objects, "generalView", "barsColor", defaultSettings.generalView.barsColor),
            minHeight: getValue<number> (objects, "generalView", "minHeight", defaultSettings.generalView.minHeight),
            opacity: getValue<number> (objects, "generalView", "opacity", defaultSettings.generalView.opacity),
            overlapColor: getValue<string> (objects, "generalView", "overlapColor",
                defaultSettings.generalView.overlapColor),
            textColor: getValue<string> (objects, "generalView", "textColor",
                defaultSettings.generalView.textColor),
        },
        showBarLabels: {
            highlightColor: getValue<string> (objects, "showBarLabels", "highlightColor",
            defaultSettings.showBarLabels.highlightColor),
            show: getValue<boolean> (objects, "showBarLabels", "show",
            defaultSettings.showBarLabels.show),
            textColor: getValue<string> (objects, "showBarLabels", "textColor",
            defaultSettings.showBarLabels.textColor),
        },
        units: {
            decimalPlaces: getValue<number> (objects, "units", "decimalPlaces",
                defaultSettings.units.decimalPlaces),
            tooltipUnits: getValue<number> (objects, "units", "tooltipUnits",
                defaultSettings.units.tooltipUnits),
        },

    };

    for (let i = 0, len = Math.max(category.values.length, dataValue.values.length); i < len; i++) {
        let defaultColor: Fill = {
            solid: {
                color: colorPalette.getColor(category.values[i] + "").value,
            },
        };

        valueFormatterForCategories = valueFormatter.valueFormatter.create({
            format: valueFormatter.valueFormatter.getFormatStringByColumn(metadata.columns[i]),
            value: dataValue,
            value2: categorical.values[categorical.values.length - 1],
        });

        let tooltip = [];
        let index;

        for (let tooltipDataItem of tooltipData) {
        // for (let j = 0; j < tooltipData.length; j++) {

            index = getMetadataIndexFor(tooltipDataItem.source.displayName, metadata.columns);

            valueFormatterForCategories = valueFormatter.valueFormatter.create({
                format: valueFormatter.valueFormatter.getFormatStringByColumn(metadata.columns[index]),
                value: dataValue,
                value2: categorical.values[categorical.values.length - 1],
            });
            tooltip.push({
                displayName: tooltipDataItem.source.displayName,
                value: valueFormatterForCategories.format(tooltipDataItem.values[i]),
            });
        }

        let format = valueFormatter.valueFormatter.getFormatStringByColumn(
            metadata.columns[getMetadataIndexFor(
                categorical.values[0].source.displayName, metadata.columns)]);

        valueFormatterForCategories = valueFormatter.valueFormatter.create({
            format,
            value: dataValue,
            value2: categorical.values[categorical.values.length - 1],
        });

        textProperties = {
            fontFamily: "Segoe UI",
            fontSize: IBarChartSettings.fontParams.fontSize + "px",
            text: valueFormatterForCategories.format(category.values[i]),
        };
        currTextWidth = textMeasurementService.textMeasurementService.measureSvgTextWidth(textProperties);

        IBarChartDataPoints.push({
            category: category.values[i] + "",
            color: getCategoricalObjectValue<Fill> (category, i, "colorSelector", "fill", defaultColor).solid.color,
            currTextWidth,
            formattedOverlapValue: "",
            formattedValue: valueFormatterForCategories.format(dataValue.values[i]),
            overlapValue: overlapDataValue.length > 0 ? overlapDataValue[i] : null,

            precision: formattingService.numberFormat.isStandardFormat(format) === false ?
                formattingService.numberFormat.getCustomFormatMetadata(format, true).precision : null,
            selected: false,
            selectionId: host.createSelectionIdBuilder()
                .withCategory(category, i)
                .createSelectionId(),
            tooltip,
            value: dataValue.values[i],
            width: null,

        });

    }
    let overlapDataValueMax = Math.max.apply(Math, overlapDataValue);

    dataMax = <number> dataValue.maxLocal <= overlapDataValueMax ? overlapDataValueMax : dataValue.maxLocal;

    return {
        dataMax,
        dataPoints: IBarChartDataPoints,
        settings: IBarChartSettings,
        widthMax: lenMax,
    };
}

function getOverlapIndex(metadata) {
    let index = -1;
    if (metadata.columns && metadata.columns.length > 0) {
        metadata.columns.forEach((element) => {
            if (element.roles.hasOwnProperty("overlapValues")) {
                index = element.index;
            }
        });
    }
    return index;
}
function getDataValueForOverlapValue(values, overlapIndex) {
    let index = -1;
    for (let i = 0; i < values.length; i++) {
        if (values[i].source.index === overlapIndex) {
            index = i;
            break;
        }
    }
    if (index !== -1) {
        return values[index].values;
    } else {
        return [];
    }
}

export class BarChart implements IVisual {

    private static Config = {
        barPadding: 0.15,
        fontScaleFactor: 3,
        maxHeightScale: 3,
        outerPaddingScale: 0.5,
        solidOpacity: 1,
        transparentOpacity: 0.5,
        xAxisFontMultiplier: 0.04,
        xScalePadding: 0.15,
        xScaledMin: 30,
    };
    private svg: Selection<SVGElement, {}, HTMLElement, any>;
    private divContainer: Selection<SVGElement, {}, HTMLElement, any>;
    private host: IVisualHost;
    private selectionManager: ISelectionManager;
    private barContainer: Selection<SVGElement, {}, HTMLElement, any>;
    private xAxis: Selection<SVGElement, {}, HTMLElement, any>;
    private IBarChartSettings: IBarChartSettings;
    private tooltipServiceWrapper: ITooltipServiceWrapper;
    private barSelection: Selection<BaseType, IBarChartDataPoint, BaseType, any>;
    private events: IVisualEventService;
    private localizationManager: ILocalizationManager;

    /**
     * Creates instance of BarChart. This method is only called once.
     *
     * @constructor
     * @param {VisualConstructorOptions} options - Contains references to the element that will
     *                                             contain the visual and a reference to the host
     *                                             which contains services.
     */
    constructor(options: VisualConstructorOptions) {
        this.localizationManager = options.host.createLocalizationManager();
        this.events = options.host.eventService;
        this.host = options.host;
        this.selectionManager = options.host.createSelectionManager();

        this.selectionManager.registerOnSelectCallback(() => {
            this.syncSelectionState(this.barSelection, this.selectionManager.getSelectionIds() as ISelectionId[]);
        });

        this.tooltipServiceWrapper = createTooltipServiceWrapper(this.host.tooltipService, options.element);

        let svg = this.svg = select(options.element)
            .append<SVGElement> ("div")
            .classed("divContainer", true)
            .append<SVGElement> ("svg")
            .classed("barChart", true);

        this.barContainer = svg.append<SVGElement> ("g")
            .classed("barContainer", true);

        this.xAxis = svg.append<SVGElement> ("g")
            .classed("xAxis", true);
        this.divContainer = select(".divContainer");

    }

    /**
     * Updates the state of the visual. Every sequential binding and resize will call update.
     *
     * @function
     * @param {VisualUpdateOptions} options - Contains references to the size of the container
     *                                        and the dataView which contains all the data
     *                                        the visual had queried.
     */
    public update(options: VisualUpdateOptions) {

        // bar chart diagram
        //  ________________________________   _
        //  |                               |  |
        //  |                               |  |  top and bottom padding (calcOuterPadding, outerPadding)
        //  |_______________________        |  _    _
        //  |                       |       |  |    |
        //  |                       |       |  |    |
        //  |_______________________|       |  _    |   x (calcX, xScaledMin, xScaledMax)
        //  |                               |  |    |   It is sum of the bar height
        //  |                               |  |    |   and the space between two bars
        //  |                               |  |    |
        //  |_____________________          |  _    _
        //  |                     |         |  |
        //  |                     |         |  | h
        //  |_____________________|         |  _
        //  |                               |  | padding between bars (barPadding).
        //  |                               |  | This is percent of x that will be
        //  |                               |  | used for padding and th rest will be bar height.
        //  |_________________              |  _
        //  |                 |             |  |
        //  |                 |             |  | h
        //  |_________________|             |  _
        //  |                               |  |
        //  |                               |  |  top and bottom padding are equal
        //  |_______________________________|  _

        this.events.renderingStarted(options);
        let viewModel: IBarChartViewModel = visualTransform(options, this.host);

        let settings = this.IBarChartSettings = viewModel.settings;
        let width = options.viewport.width;
        let height = options.viewport.height;

        // Calculate max height of each bar based on the total height of the visual
        let xScaledMax = height / BarChart.Config.maxHeightScale;
        // Min height is independent of height the bar should be visible
        // irrespective of the number of bars or the height of the visual
        let xScaledMin = BarChart.Config.xScaledMin;
        if (settings.barHeight && settings.barHeight.show) {

            xScaledMin = settings.barHeight.height;
        } else {
            xScaledMin = BarChart.Config.xScaledMin;
        }
        let outerPadding = -0.1;
        // calcX is the calculated height of the bar+inner padding that will be required if we simply
        // distribute the height with the bar count (no scrolling)
        let calcX = height /
            (2 * BarChart.Config.outerPaddingScale - BarChart.Config.xScalePadding + viewModel.dataPoints.length);
        // calcHeight is the height required for the entire bar chart
        // if min allowed bar height is used. (This is needed for setting the scroll height)
        let calcHeight = (-2 * outerPadding - BarChart.Config.xScalePadding + viewModel.dataPoints.length)
             * xScaledMin;
        // The parent element is not directly available to us since we are in a sandbox

        if (calcX > xScaledMax) {
            if (xScaledMax >= xScaledMin) {
                let tempouterPadding = (height - (-BarChart.Config.xScalePadding + viewModel.dataPoints.length)
                     * xScaledMax) /
                    (2 * xScaledMax);
                if (tempouterPadding > 0) {
                    outerPadding = tempouterPadding;
                }
            } else {
                let tempOuterPadding = (height - (-BarChart.Config.xScalePadding + viewModel.dataPoints.length)
                     * xScaledMin) /
                    (2 * xScaledMin);
                if (tempOuterPadding > 0) {
                    outerPadding = tempOuterPadding;
                }
            }
        } else {
            if (calcX < xScaledMin && calcHeight > height) {
                height = calcHeight;
            }
        }
        let h = options.viewport.height + 5;
        let w = options.viewport.width;
        this.divContainer.attr("style", "width:" + w + "px;height:" + h + "px;overflow-y:auto;overflow-x:hidden;");

        this.svg.attr("width", width);
        this.svg.attr("height", height);

        this.xAxis.style("font-size", parseInt(min(<any>[height, width]), 10) * BarChart.Config.xAxisFontMultiplier);
        // this.xAxis.attr("font-size",parseInt(min([height, width])) * BarChart.Config.xAxisFontMultiplier)
        let yScale = scaleBand()
            .domain(viewModel.dataPoints.map((d) => d.category))
            .rangeRound([5, height])
            .padding(BarChart.Config.barPadding)
            .paddingOuter(outerPadding);
        // .rangeBands([5, height], BarChart.Config.barPadding, outerPadding);

        // cap the fontsize between 8.5 and 40 for aesthetics (only when autoscaling font)
        let fontSizeToUse = this.IBarChartSettings.fontParams && this.IBarChartSettings.fontParams.show
            ? this.IBarChartSettings.fontParams.fontSize
            : yScale.bandwidth() / BarChart.Config.fontScaleFactor;
        if (fontSizeToUse < 8.5 && !this.IBarChartSettings.fontParams.show) {
            fontSizeToUse = 8.5;
        }
        if (fontSizeToUse > 40 && !this.IBarChartSettings.fontParams.show) {
            fontSizeToUse = 40;
        }

        // Calculate label size to compute max bar size to use
        //  to leave room for label to be displayed inside the draw area for the .
        // Use the formatted value for the longest bar
        let indexForDataMax = getIndexForDataMax(viewModel.dataPoints);
        let formattedValue = viewModel.dataPoints.length > 0
            ? viewModel.dataPoints[indexForDataMax].formattedValue
            : "";

        let textProperties: ITextProperties = {
            fontFamily: "sans-serif",
            fontSize: fontSizeToUse + "px",
            text: formattedValue,
        };
        let offset = textMeasurementService.textMeasurementService.measureSvgTextWidth(textProperties);
        let xScale = scaleLinear()
            .domain([0, viewModel.dataMax])
            .range([0, width - offset - 40]); // subtracting 40 for padding between the bar and the label

        // empty rect to take full width for clickable area for clearing selection

        let rectContainer = this.barContainer.selectAll("rect.rect-container").data([0]);

        rectContainer
            .enter()
            .append<SVGElement> ("rect")
            .classed("rect-container", true);

        rectContainer.attr("width", width);
        rectContainer.attr("height", height);
        rectContainer.attr("fill", "transparent");

        let bars = this.barContainer
            .selectAll("g.bar")
            .data(viewModel.dataPoints);

        if (viewModel.dataPoints.length === 0) {
            let removeBars = this.barContainer.selectAll("g.bar");
            removeBars.selectAll("rect.bar").remove();
            removeBars.selectAll("rect.overlapBar").remove();
            removeBars.selectAll("circle").remove();
            removeBars.selectAll("line").remove();
            removeBars.selectAll("text.bar-value").remove();
            removeBars.selectAll("text.bar-text").remove();
            removeBars.selectAll("rect.valuesRect").remove();
            removeBars.remove();
        }

        bars
            .enter()
            .append<SVGElement> ("g")
            .classed("bar", true)
            .attr("x", BarChart.Config.xScalePadding)// .merge(bars)
            .attr("y", (d) => yScale(d.category))
            .attr("height", yScale.bandwidth())
            .attr("width", (d) => xScale(<number> d.value))

            .attr("selected", (d) => d.selected);

        bars = this.barContainer
            .selectAll("g.bar")
            .data(viewModel.dataPoints);

        let rects = bars
            .selectAll("rect.bar").data((d) => [d]);

        let mergeElement = rects
            .enter()
            .append<SVGElement> ("rect")
            .classed("bar", true);

        rects
            .merge(mergeElement)
            .attr("x", BarChart.Config.xScalePadding)
            .attr("y", (d) => yScale(d.category))
            .attr("height", yScale.bandwidth() /
                (
                    (settings.barShape.shape === "Line" ||
                     settings.barShape.shape === "Lollipop" ||
                     settings.barShape.shape === "Hammer Head") ? 8 : 1
                ))
            .attr("width", (d) => xScale(<number> d.value))
            .attr("fill", viewModel.settings.generalView.barsColor.solid.color)
            .attr("fill-opacity", viewModel.settings.generalView.opacity / 100)
            .attr("selected", (d) => d.selected);

        rects.exit().remove();
        let overlapRects = bars.selectAll("rect.overlapBar").data((d) => [d]);

        mergeElement = overlapRects
            .enter()
            .append<SVGElement> ("rect")
            .classed("overlapBar", true);

        overlapRects
            .merge(mergeElement)
            // overlapRects
            .attr("x", BarChart.Config.xScalePadding)
            .attr("y", (d) => yScale(d.category))
            .attr("height", yScale.bandwidth() /
                (
                    (
                        settings.barShape.shape === "Line" ||
                        settings.barShape.shape === "Lollipop" ||
                        settings.barShape.shape === "Hammer Head"
                    ) ? 8 : 1))
            .attr("width", (d) => xScale(<number> d.overlapValue)).merge(mergeElement)
            .attr("fill", viewModel.settings.generalView.overlapColor.solid.color)
            .attr("fill-opacity", viewModel.settings.generalView.opacity / 100)
            .attr("selected", (d) => d.selected);

        overlapRects.exit().remove();

        if (settings.barShape.shape === "Lollipop") {
            let circle = bars.selectAll("circle").data((d) => [d]);

            mergeElement = circle.enter()
                .append<SVGElement> ("circle")
                .classed("head", true);

            circle
                .merge(mergeElement)
                .attr("cx", (d) => getHeadPositionX(d.value, d.width) - 2 - yScale.bandwidth() / 8)
                .attr("cy", (d) => yScale(d.category) + yScale.bandwidth() / 16)
                // - textMeasurementService.textMeasurementService.measureSvgTextHeight(textProperties) / 4,
                .attr("r", yScale.bandwidth() / 8)
                .attr("fill", viewModel.settings.barShape.headColor.solid.color)
                .attr("fill-opacity", viewModel.settings.generalView.opacity / 100);
            circle.exit().remove();
        } else {
            bars.selectAll("circle").remove();
        }

        if (settings.barShape.shape === "Hammer Head") {
            let line = bars.selectAll("line").data((d) => [d]);

            mergeElement = line.enter()
                .append<SVGElement> ("line")
                .classed("head", true);

            line.merge(mergeElement)
                .attr("x1", (d) => getHeadPositionX(d.value, d.width) - 7 - yScale.bandwidth() / 32)
                .attr("x2", (d) => getHeadPositionX(d.value, d.width) - 7 - yScale.bandwidth() / 32)
                .attr("y1", (d) => yScale(d.category) - yScale.bandwidth() / 16)
                // - textMeasurementService.textMeasurementService.measureSvgTextHeight(textProperties) / 4,
                .attr("y2", (d) => yScale(d.category) + yScale.bandwidth() / 16 + yScale.bandwidth() / 8)
                // - textMeasurementService.textMeasurementService.measureSvgTextHeight(textProperties) / 4,
                .attr("stroke-width", yScale.bandwidth() / 16)
                .attr("stroke", viewModel.settings.barShape.headColor.solid.color)
                .attr("stroke-opacity", viewModel.settings.generalView.opacity / 100);
            line.exit().remove();
        } else {
            bars.selectAll("line").remove();
        }

        textProperties = {
            fontFamily: "Segoe UI",
            fontSize: fontSizeToUse + "px",
            text: "TEXT for calculating height",
        };

        let texts = bars
            .selectAll("text.bar-text").data((d) => [d]);

        mergeElement = texts
            .enter()
            .append<SVGElement> ("text")
            .classed("bar-text", true);

        texts.merge(mergeElement)
            .attr("height", yScale.bandwidth())
            .attr("y", (d) => yScale(d.category) + yScale.bandwidth() /
                2 + textMeasurementService.textMeasurementService.measureSvgTextHeight(textProperties) / 4)
            .attr("x", 5)
            .attr("font-size", fontSizeToUse)
            .attr("fill", viewModel.settings.generalView.textColor.solid.color)

            .text((d) => d.category )
            .each((d) => d.width = xScale(<number> d.value));
        if (this.IBarChartSettings.experimental.show) {
            texts.attr("style", "mix-blend-mode: " + this.IBarChartSettings.experimental.blendMode);
        } else {
            texts.attr("style", "mix-blend-mode: initial");
        }

        texts.exit().remove();
        if (viewModel.settings.showBarLabels.show) {
            let valuesRect = bars.selectAll("rect.valuesRect").data((d) => [d]);

            mergeElement = valuesRect
                .enter()
                .append<SVGElement> ("rect")
                .classed("valuesRect", true);

            valuesRect
                .merge(mergeElement)
                .attr("x", (d) => viewModel.settings.alignBarLabels.show
                    ? getTextPositionX(viewModel.dataMax, d.currTextWidth) - 2
                    : getTextPositionX(d.value, d.currTextWidth) - 2)
                .attr("y", (d) => getTextPositionY(d.category, textProperties) - 3
                    / 4 * textMeasurementService.textMeasurementService.measureSvgTextHeight(textProperties))
                .attr("height", textMeasurementService.textMeasurementService.measureSvgTextHeight(textProperties))

                // width is adding 5 for padding around text
                .attr("width", (d) => 5 + textMeasurementService.textMeasurementService.measureSvgTextWidth(
                    {
                        fontFamily: "Segoe UI",
                        fontSize: fontSizeToUse + "px",
                        text: <string> d.formattedValue,
                    }))
                .attr("fill", viewModel.settings.showBarLabels.highlightColor.solid.color)
                .attr("fill-opacity", viewModel.settings.generalView.opacity / 100)
                .attr("rx", 2)
                .attr("ry", 2);

            valuesRect.exit().remove();

            let textValues = bars
                .selectAll("text.bar-value").data((d) => [d]);

            mergeElement = textValues
                .enter()
                .append<SVGElement> ("text")
                .classed("bar-value", true);

            textValues.merge(mergeElement).attr("height", yScale.bandwidth())
                .attr("y", (d) => getTextPositionY(d.category, textProperties))
                .attr("x", (d) => {
                    return viewModel.settings.alignBarLabels.show
                        ? getTextPositionX(viewModel.dataMax, d.currTextWidth)
                        : getTextPositionX(d.value, d.currTextWidth);
                })
                .attr("font-size", fontSizeToUse)
                .attr("fill", viewModel.settings.showBarLabels.textColor.solid.color)
                .text((d) => { return <string> d.formattedValue; });
            textValues.exit().remove();
        }

        this.tooltipServiceWrapper.addTooltip(this.barContainer.selectAll(".bar"),
            (tooltipEvent: ITooltipEventArgs<IBarChartDataPoint>) => this.getTooltipData(tooltipEvent.data),
            (tooltipEvent: ITooltipEventArgs<IBarChartDataPoint>) => tooltipEvent.data.selectionId,
        );

        this.syncSelectionState(
            bars,
            this.selectionManager.getSelectionIds() as ISelectionId[],
        );
        this.syncSelectionState(
            rects,
            this.selectionManager.getSelectionIds() as ISelectionId[],
        );
        this.syncSelectionState(
            overlapRects,
            this.selectionManager.getSelectionIds() as ISelectionId[],
        );

        let selectionManager = this.selectionManager;
        // this.svg.on("contextmenu", () => {

        //     const mouseEvent: MouseEvent = event as MouseEvent;
        //     const eventTarget: EventTarget = mouseEvent.target;
        //     let dataPoint = select(eventTarget).datum();
        //     selectionManager.showContextMenu(dataPoint ? dataPoint.selectionId : {}, {
        //         x: mouseEvent.clientX,
        //         y: mouseEvent.clientY
        //     });
        //     mouseEvent.preventDefault();
        // });

        // This must be an anonymous function instead of a lambda because
        // d3 uses "this" as the reference to the element that was clicked.

        let area = select("rect.rect-container");
        area.on("click", () => {

            if (self.IBarChartSettings.clearFilters.show && selectionManager.hasSelection()) {
                selectionManager.clear().then(() => {
                    self.syncSelectionState(bars, []);
                    self.syncSelectionState(rects, []);
                    self.syncSelectionState(overlapRects, []);
                });
            }

            bars.attr("fill-opacity", BarChart.Config.solidOpacity);
            rects.attr("fill-opacity", BarChart.Config.solidOpacity);
            overlapRects.attr("fill-opacity", BarChart.Config.solidOpacity);

        });
        let self: this = this;

        bars.on("click", (d) => {

            // set selected property of the attached data to false for all (later mark the one clicked as selected)

            selectionManager.select(d.selectionId).then((ids: ISelectionId[]) => {
                self.syncSelectionState(bars, ids);
                self.syncSelectionState(rects, ids);
                self.syncSelectionState(overlapRects, ids);
            });
        });
        bars.exit()
            .remove();

        function getTextPositionX(value: PrimitiveValue, wid: number) {
            if (settings.barShape.shape === "Bar") {
                return xScale(<number> value) > wid ? xScale(<number> value) + 8 : wid + 12;
            } else if (
                settings.barShape.shape === "Line" ||
                settings.barShape.shape === "Lollipop" ||
                settings.barShape.shape === "Hammer Head") {
                if (viewModel.settings.alignBarLabels.show) {
                    return 1.01 * (xScale(<number> value) + 8);
                }
                if (settings.barShape.labelPosition === "Top") {
                    return 1.01 * (xScale(<number> value) + 8);
                } else {
                    return 1.01 * (wid + 8);
                }
            }
        }

        function getTextPositionY(category: string, textProps: TextProperties) {
            if (settings.barShape.shape === "Bar") {
                return yScale(category) + yScale.bandwidth() / 2 +
                    textMeasurementService.textMeasurementService.measureSvgTextHeight(textProps) / 4;
            } else if (settings.barShape.shape === "Line" ||
                    settings.barShape.shape === "Lollipop" ||
                    settings.barShape.shape === "Hammer Head") {
                if (settings.barShape.labelPosition === "Top") {
                    return yScale(category) +
                    yScale.bandwidth() / 16 +
                    textMeasurementService.textMeasurementService.measureSvgTextHeight(textProps) / 4;
                } else {
                    return yScale(category) +
                    yScale.bandwidth() / 2 +
                    textMeasurementService.textMeasurementService.measureSvgTextHeight(textProps) / 4;
                }
            }
        }

        function getHeadPositionX(value: PrimitiveValue, wid: number) {

            if (settings.barShape.shape === "Bar") {
                return xScale(<number> value) > wid ? xScale(<number> value) + 8 : wid + 8;
            } else if (settings.barShape.shape === "Line" ||
                settings.barShape.shape === "Lollipop" ||
                settings.barShape.shape === "Hammer Head") {
                return xScale(<number> value) + 8;
            }
        }

        this.events.renderingFinished(options);
    }

    /**
     *  through the objects defined in the capabilities and adds the properties to the format pane
     *
     * @function
     * @param {EnumerateVisualObjectInstancesOptions} options - Map of defined objects
     */
    public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstanceEnumeration {
        let objectName = options.objectName;
        let objectEnumeration: VisualObjectInstance[] = [];

        switch (objectName) {
            case "fontParams":
                objectEnumeration.push({
                    objectName,
                    properties: {
                        fontSize: this.IBarChartSettings.fontParams.fontSize,
                        show: this.IBarChartSettings.fontParams.show,
                    },
                    selector: null,
                });
                break;
            case "generalView":
                objectEnumeration.push({
                    objectName,
                    properties: {
                        barsColor: this.IBarChartSettings.generalView.barsColor,
                        opacity: this.IBarChartSettings.generalView.opacity,
                        overlapColor: this.IBarChartSettings.generalView.overlapColor,
                        textColor: this.IBarChartSettings.generalView.textColor,
                    },
                    selector: null,
                    validValues: {
                        barHeight: {
                            numberRange: {
                                max: 200,
                                min: 20,
                            },
                        },
                        minHeight: {
                            numberRange: {
                                max: 2500,
                                min: 50,
                            },
                        },
                        opacity: {
                            numberRange: {
                                max: 100,
                                min: 10,
                            },
                        },
                    },
                });
                break;
            case "showBarLabels":
                objectEnumeration.push({
                    objectName,
                    properties: {
                        highlightColor: this.IBarChartSettings.showBarLabels.highlightColor,
                        show: this.IBarChartSettings.showBarLabels.show,
                        textColor: this.IBarChartSettings.showBarLabels.textColor,
                    },
                    selector: null,
                });
                break;
            case "alignBarLabels":
                objectEnumeration.push({
                    objectName,
                    properties: {
                        show: this.IBarChartSettings.alignBarLabels.show,
                    },
                    selector: null,
                });
                break;
            case "barShape":
                objectEnumeration.push({
                    objectName,
                    properties: {
                        headColor: this.IBarChartSettings.barShape.headColor,
                        labelPosition: this.IBarChartSettings.barShape.labelPosition,
                        shape: this.IBarChartSettings.barShape.shape,
                    },
                    selector: null,
                });
                break;
            case "barHeight":
                objectEnumeration.push({
                    objectName,
                    properties: {
                        height: this.IBarChartSettings.barHeight.height,
                        show: this.IBarChartSettings.barHeight.show,
                    },
                    selector: null,
                    validValues: {

                        height: {
                            numberRange: {
                                max: 200,
                                min: 20,
                            },
                        },
                    },
                });
                break;
            case "experimental":
                objectEnumeration.push({
                    objectName,
                    properties: {
                        blendMode: this.IBarChartSettings.experimental.blendMode,
                        show: this.IBarChartSettings.experimental.show,
                    },

                    selector: null,
                });
                break;
            case "clearFilters":
                objectEnumeration.push({
                    objectName,
                    properties: {
                        show: this.IBarChartSettings.clearFilters.show,
                    },

                    selector: null,
                });
                break;
            default:
                break;
        }

        return objectEnumeration;
    }

    /**
     * Destroy runs when the visual is removed. Any cleanup that the visual needs to
     * do should be done here.
     *
     * @function
     */
    public destroy(): void {
        // Perform any cleanup tasks here
    }
    private isSelectionIdInArray(selectionIds: ISelectionId[], selectionId: ISelectionId): boolean {
        if (!selectionIds || !selectionId) {
            return false;
        }

        return selectionIds.some((currentSelectionId: ISelectionId) => {
            return currentSelectionId.includes(selectionId);
        });
    }

    private syncSelectionState(
        selection: Selection<BaseType, IBarChartDataPoint, BaseType, any>,
        selectionIds: ISelectionId[]): void {
        if (!selection || !selectionIds) {
            return;
        }

        if (!selectionIds.length) {
            selection.style("fill-opacity", null);
            return;
        }

        const self: this = this;
        selection.each((barDataPoint , i , nodes) => {
            const isSelected: boolean = self.isSelectionIdInArray(selectionIds, barDataPoint.selectionId);
            select(nodes[i]).style(
                "fill-opacity",
                isSelected
                    ? BarChart.Config.solidOpacity
                    : BarChart.Config.transparentOpacity,
            );
        });

    }
    private getTooltipData(value: any): VisualTooltipDataItem[] {

        let tooltip = [];

        tooltip.push({
            // header: value.category,
            displayName: value.category,
            value: value.formattedValue,
        });

        value.tooltip.forEach((element) => {
            tooltip.push(
                {
                    displayName: element.displayName,
                    value: (typeof (element.value) === "string"
                        ? (element.value || 0).toString()
                        : (this.IBarChartSettings.units.decimalPlaces != null
                            ? parseFloat(element.value).toFixed(this.IBarChartSettings.units.decimalPlaces)
                            : element.value)),
                });
        });

        return tooltip;
    }
}
function getMetadataIndexFor(displayName: any, values: any) {
    let i;

    for (i = 0; i < values.length; i++) {

        if (values[i].displayName === displayName) {
            return i;
        }
    }
    return i;
}
function getIndexForDataMax(arr) {
    if (arr.length < 1) {
        return 0;
    }
    let i = 0;
    let p = 0;
    let max = arr[i].value;
    for (i = 1; i < arr.length; i++) {

        if (arr[i].value > max) {
            max = arr[i].value;
            p = i;
        }
    }
    return p;
}
