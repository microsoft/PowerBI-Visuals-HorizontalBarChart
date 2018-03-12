import ValueFormatter = powerbi.extensibility.utils.formatting.valueFormatter;
import TextProperties = powerbi.extensibility.utils.formatting.TextProperties;
import IValueFormatter = powerbi.extensibility.utils.formatting.IValueFormatter;
import textMeasurementService = powerbi.extensibility.utils.formatting.textMeasurementService;
import NumberFormat = powerbi.extensibility.utils.formatting.numberFormat;
module powerbi.extensibility.visual {
    /**
     * Interface for BarCharts viewmodel.
     *
     * @interface
     * @property {BarChartDataPoint[]} dataPoints - Set of data points the visual will render.
     * @property {number} dataMax                 - Maximum data value in the set of data points.
     */
    interface BarChartViewModel {
        dataPoints: BarChartDataPoint[];
        dataMax: number;
        settings: BarChartSettings;
    };
    // interface used by text measurement services
    interface TextProperties {
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
    interface BarChartDataPoint {
        value: PrimitiveValue;
        formattedValue: string,
        overlapValue: PrimitiveValue,
        formattedOverlapValue: string,
        category: string;
        precision : number;
        tooltip: any;
        color: string;
        selectionId: ISelectionId;
        width:number;
    };

    /**
     * Interface for BarChart settings.
     *
     * @interface

     */
    interface BarChartSettings {

        generalView: {
            minHeight: number;
            barHeight: number;
            opacity: number;
            barsColor: any;
            overlapColor: any;
            textColor: any;
            
        };
        fontParams:{
            show : boolean,
            fontSize : number
        };
        units:{
            tooltipUnits: number,
            decimalPlaces: number
        };
        showBarLabels:{
            show : boolean,
            textColor: any
        };
        barShape:{
            shape:string,
            labelPosition:string,
            headColor:any,
        };
        barHeight:{
            show:boolean,
            height:number
        };
        experimental:{
            show: boolean
            blendMode:string
        }
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
    function visualTransform(options: VisualUpdateOptions, host: IVisualHost): BarChartViewModel {
        let dataViews = options.dataViews;
        let defaultSettings: BarChartSettings = {

            generalView: {
                minHeight: 250,
                barHeight: 30,
                opacity: 100,
                barsColor: { solid: { color: "turquoise" } },
                overlapColor: { solid: { color: "#FEA19E" } },
                textColor: { solid: { color: "#000" } }
            },
            fontParams: {
                show: false,
                fontSize: 11
            },
            units:{
                tooltipUnits:0,
                decimalPlaces:null
            },
            showBarLabels: {
                show :true,
                textColor: { solid: { color: "#000" } }
            },
            barShape:{
                shape :"Bar",
                labelPosition:"Top",
                headColor: { solid: { color: "#FEA19E" } },
            },
            barHeight:{
                show: true,
                height: 30
                
            },
            experimental:{
                show:false,
                blendMode: "difference"
            }
        };
        let viewModel: BarChartViewModel = {
            dataPoints: [],
            dataMax: 0,
            settings: <BarChartSettings>{}
        };

        if (!dataViews
            || !dataViews[0]
            || !dataViews[0].categorical
            || !dataViews[0].categorical.categories
            || !dataViews[0].categorical.categories[0].source
            || !dataViews[0].categorical.values)
            return viewModel;

        let categorical = dataViews[0].categorical;
        let category = categorical.categories[0];
        let dataValue = categorical.values[0];
        let metadata = dataViews[0].metadata;

        let overlapDataValue = [];
        // console.log("categorical");
        // console.log(categorical);
        // console.log("metadata");
        // console.log(metadata);
        
        //let totalCategories = getTotalCategories(metadata);
        let overlapIndex = getOverlapIndex(metadata);

        if(overlapIndex !=-1){
            overlapDataValue = getDataValueForOverlapValue(categorical.values, overlapIndex);
        }
        
        let tooltipData = categorical.values.slice(1, categorical.values.length);

        let valueFormatterForCategories: IValueFormatter = ValueFormatter.create({
            format: ValueFormatter.getFormatStringByColumn(metadata.columns[0]),
            value: dataValue,
            value2: categorical.values[categorical.values.length - 1]
        });

        let barChartDataPoints: BarChartDataPoint[] = [];
        let dataMax: number;

        let colorPalette: IColorPalette = host.colorPalette;
        let objects = metadata.objects;
        let barChartSettings: BarChartSettings = {

            generalView: {
                minHeight: getValue<number>(objects, 'generalView', 'minHeight', defaultSettings.generalView.minHeight),
                barHeight: getValue<number>(objects, 'generalView', 'barHeight', defaultSettings.generalView.barHeight),
                opacity: getValue<number>(objects, 'generalView', 'opacity', defaultSettings.generalView.opacity),
                barsColor: getValue<string>(objects, 'generalView', 'barsColor', defaultSettings.generalView.barsColor),
                overlapColor: getValue<string>(objects, 'generalView', 'overlapColor', defaultSettings.generalView.overlapColor),
                textColor: getValue<string>(objects, 'generalView', 'textColor', defaultSettings.generalView.textColor)
            },
            fontParams:{
                show:getValue<boolean>(objects, 'fontParams', 'show', defaultSettings.fontParams.show),
                fontSize: getValue<number>(objects, 'fontParams', 'fontSize', defaultSettings.fontParams.fontSize),
            },
            units:{
                tooltipUnits:getValue<number>(objects, 'units', 'tooltipUnits', defaultSettings.units.tooltipUnits),
                decimalPlaces:getValue<number>(objects, 'units', 'decimalPlaces', defaultSettings.units.decimalPlaces)
            },
            showBarLabels:{
                show:getValue<boolean>(objects, 'showBarLabels', 'show', defaultSettings.showBarLabels.show),
                textColor: getValue<string>(objects, 'showBarLabels', 'textColor', defaultSettings.showBarLabels.textColor)
            },
            barShape:{
                shape: getValue<string>(objects, 'barShape', 'shape', defaultSettings.barShape.shape),
                labelPosition: getValue<string>(objects, 'barShape', 'labelPosition', defaultSettings.barShape.labelPosition),
                headColor: getValue<string>(objects, 'barShape', 'headColor', defaultSettings.barShape.headColor),
            },
            barHeight:{
                show:getValue<boolean>(objects, 'barHeight', 'show', defaultSettings.barHeight.show),
                height:getValue<number>(objects, 'barHeight', 'height', defaultSettings.barHeight.height) 
            },
            experimental:{
                show:getValue<boolean>(objects, 'experimental', 'show', defaultSettings.experimental.show),
                blendMode:getValue<string>(objects, 'experimental', 'blendMode', defaultSettings.experimental.blendMode),
            }
        }
  
        for (let i = 0, len = Math.max(category.values.length, dataValue.values.length); i < len; i++) {
            let defaultColor: Fill = {
                solid: {
                    color: colorPalette.getColor(category.values[i] + '').value
                }
            };

            valueFormatterForCategories = ValueFormatter.create({
                format: ValueFormatter.getFormatStringByColumn(metadata.columns[i]),
                value: dataValue,
                value2: categorical.values[categorical.values.length - 1]
            });

            var tooltip = [];
            var index;

            for (let j = 0; j < tooltipData.length; j++) {

                index = getMetadataIndexFor(tooltipData[j].source.displayName, metadata.columns);

                valueFormatterForCategories = ValueFormatter.create({
                    format: ValueFormatter.getFormatStringByColumn(metadata.columns[index]),
                    value: dataValue,
                    value2: categorical.values[categorical.values.length - 1]
                });
                tooltip.push({ displayName: tooltipData[j].source.displayName, value: valueFormatterForCategories.format(tooltipData[j].values[i]) });
            }

                 
            let format = ValueFormatter.getFormatStringByColumn(metadata.columns[getMetadataIndexFor(categorical.values[0].source.displayName, metadata.columns)]);
            valueFormatterForCategories = ValueFormatter.create({
                    format: format,
                    value: dataValue,
                    value2: categorical.values[categorical.values.length - 1]
                });
                
            barChartDataPoints.push({
                category: category.values[i] + '',
                value: dataValue.values[i],
                formattedValue: valueFormatterForCategories.format(dataValue.values[i]),
                overlapValue: overlapDataValue.length > 0 ? overlapDataValue[i] : null,
                formattedOverlapValue: "",
                precision: NumberFormat.isStandardFormat(format) == false ? NumberFormat.getCustomFormatMetadata(format, true /*calculatePrecision*/).precision : null,//NumberFormat.getCustomFormatMetadata(format, true /*calculatePrecision*/).precision,
                tooltip: tooltip,
                color: getCategoricalObjectValue<Fill>(category, i, 'colorSelector', 'fill', defaultColor).solid.color,
                selectionId: host.createSelectionIdBuilder()
                    .withCategory(category, i)
                    .createSelectionId(),
                width: null
            });

        }
        let overlapDataValueMax = Math.max.apply(Math, overlapDataValue);

        dataMax = <number>dataValue.maxLocal <= overlapDataValueMax ? overlapDataValueMax : dataValue.maxLocal;
        return {
            dataPoints: barChartDataPoints,
            dataMax: dataMax,
            settings: barChartSettings,
        };
    }
    function getOverlapIndex(metadata){
        let index = -1;
        if(metadata.columns && metadata.columns.length > 0){
            metadata.columns.forEach(element => {
                if(element.roles.hasOwnProperty("overlapValues")){
                    index =  element.index;
                }
             });
        }
        return index;
    }
    function getDataValueForOverlapValue(values, overlapIndex){
        let index = -1;
        for(var i=0;i<values.length;i++){
            if(values[i].source.index == overlapIndex){
                index = i;
                break;
            }
        }
        if (index != -1)
            return values[index].values;
        else return [];
    }

    export class BarChart implements IVisual {
        private svg: d3.Selection<SVGElement>;
        private divContainer: d3.Selection<SVGElement>;
        private host: IVisualHost;
        private selectionManager: ISelectionManager;
        private selectionIdBuilder: ISelectionIdBuilder;
        private barChartContainer: d3.Selection<SVGElement>;
        private barContainer: d3.Selection<SVGElement>;
        private xAxis: d3.Selection<SVGElement>;
        private barDataPoints: BarChartDataPoint[];
        private barChartSettings: BarChartSettings;
        private tooltipServiceWrapper: ITooltipServiceWrapper;
        private locale: string;
        private data: Object[];

        static Config = {
            xScalePadding: 0.15,
            barPadding : 0.15,
            xScaledMin: 30,
            outerPaddingScale : 0.5,
            fontScaleFactor : 3,
            solidOpacity: 1,
            transparentOpacity: 0.5,
            xAxisFontMultiplier: 0.04,
            maxHeightScale: 3
        };

        /**
         * Creates instance of BarChart. This method is only called once.
         *
         * @constructor
         * @param {VisualConstructorOptions} options - Contains references to the element that will
         *                                             contain the visual and a reference to the host
         *                                             which contains services.
         */
        constructor(options: VisualConstructorOptions) {
            this.host = options.host;
            this.locale = options.host.locale;
            this.selectionManager = options.host.createSelectionManager();
            this.selectionIdBuilder = options.host.createSelectionIdBuilder();
            this.tooltipServiceWrapper = createTooltipServiceWrapper(this.host.tooltipService, options.element);
            
            let svg = this.svg = d3.select(options.element)
                .append('div')
                .classed('divContainer',true)
                .append('svg')
                .classed('barChart', true);

            this.barContainer = svg.append('g')
                .classed('barContainer', true);

            this.xAxis = svg.append('g')
                .classed('xAxis', true);

            this.divContainer = d3.select('.divContainer');
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
            //  |                               |  |
            //  |                               |  | padding between bars (barPadding). 
            //  |                               |  | This is percent of x that will be used for padding and th rest will be bar height.
            //  |_________________              |  _
            //  |                 |             |  |
            //  |                 |             |  | h
            //  |_________________|             |  _
            //  |                               |  |
            //  |                               |  |  top and bottom padding are equal
            //  |_______________________________|  _

            let viewModel: BarChartViewModel = visualTransform(options, this.host);
            let settings = this.barChartSettings = viewModel.settings;
            this.barDataPoints = viewModel.dataPoints;
            let width = options.viewport.width;
            let height = options.viewport.height;

            // Calculate max height of each bar based on the total height of the visual
            let xScaledMax =  height/BarChart.Config.maxHeightScale;
            // Min height is independent of height the bar should be visible irrespective of the number of bars or the height of the visual
            let xScaledMin = BarChart.Config.xScaledMin;
            if(settings.barHeight.show){
                
                xScaledMin = settings.barHeight.height;
            }
            else xScaledMin = BarChart.Config.xScaledMin;
            
            let outerPadding = 0.1;
            // calcX is the calculated height of the bar+inner padding that will be required if we simply distribute the height with the bar count (no scrolling)
            let calcX = height/(2*BarChart.Config.outerPaddingScale - BarChart.Config.xScalePadding + viewModel.dataPoints.length);
            // calcOuterPadding is the padding required if the bar height+inner padding = xScaledMax which is the max allowed value calculated earlier
            let calcOuterPadding = (height - (-BarChart.Config.xScalePadding + viewModel.dataPoints.length)*xScaledMax)/(2*xScaledMax);
            // calcHeight is the height required for the entire bar chart if min allowed bar height is used. (This is needed for setting the scroll height)
            let calcHeight = (-2*outerPadding - BarChart.Config.xScalePadding + viewModel.dataPoints.length)*xScaledMin;
            // The parent element is not directly available to us since we are in a sandbox

            if(calcX > xScaledMax ){
                if(xScaledMax >= xScaledMin){
                    let tempouterPadding = (height - (-BarChart.Config.xScalePadding + viewModel.dataPoints.length)*xScaledMax)/(2*xScaledMax);    
                    if (tempouterPadding > 0) outerPadding = tempouterPadding
                }
                else{
                    let tempOuterPadding = (height - (-BarChart.Config.xScalePadding + viewModel.dataPoints.length)*xScaledMin)/(2*xScaledMin);    
                    if (tempOuterPadding > 0) outerPadding = tempOuterPadding      
                }    
            }
            else{ 
                if(calcX < xScaledMin && calcHeight > height){
                    height = calcHeight;
                }
            }
            let h = options.viewport.height+5;
            let w = options.viewport.width;
            this.divContainer.attr({
                style : 'width:'+w+'px;height:'+h+'px;overflow-y:auto;overflow-x:hidden;'
            });

            this.svg.attr({
                width: width,
                height: height
            });

            this.xAxis.style({
                'font-size': d3.min([height, width]) * BarChart.Config.xAxisFontMultiplier,
            });

            let yScale = d3.scale.ordinal()
                .domain(viewModel.dataPoints.map(d => d.category))
                .rangeBands([5, height], BarChart.Config.barPadding, outerPadding);

            // cap the fontsize between 8.5 and 40 for aesthetics (only when autoscaling font)
            let fontSizeToUse =  this.barChartSettings.fontParams.show ? this.barChartSettings.fontParams.fontSize : yScale.rangeBand() / BarChart.Config.fontScaleFactor;
            if(fontSizeToUse < 8.5 && !this.barChartSettings.fontParams.show)
                fontSizeToUse = 8.5;
            if(fontSizeToUse > 40 && !this.barChartSettings.fontParams.show)
                fontSizeToUse = 40;

            // Calculate label size to compute max bar size to use 
            //  to leave room for label to be displayed inside the draw area for the .
            // Use the formatted value for the longest bar
            let indexForDataMax = getIndexForDataMax(viewModel.dataPoints);
            let formattedValue = viewModel.dataPoints[indexForDataMax].formattedValue;
            
            let textProperties: TextProperties = {
                text: formattedValue,
                fontFamily: "sans-serif",
                fontSize: fontSizeToUse+'px'
            };
            let offset = textMeasurementService.measureSvgTextWidth(textProperties);
            let xScale = d3.scale.linear()
                .domain([0, viewModel.dataMax])
                .range([0, width-offset - 30]); //subtracting 30 for padding between the bar and the label

            let bars = this.barContainer
                .selectAll('g.bar')
                .data(viewModel.dataPoints);

            bars
                .enter()
                .append('g')
                .classed('bar', true);

            bars.attr({
                x: d => BarChart.Config.xScalePadding,
                y: d => yScale(d.category),
                height: yScale.rangeBand(),
                width: d => xScale(<number>d.value)
            });

            let rects = bars.selectAll("rect.bar").data(d => [d]);
            rects.enter()
                .append('rect')
                .classed('bar', true);

            rects
                .attr({
                    x: d => BarChart.Config.xScalePadding,
                    y: d => yScale(d.category),
                    height: yScale.rangeBand()/((settings.barShape.shape == "Line" || settings.barShape.shape == "Lollipop" || settings.barShape.shape == "Hammer Head")  ? 8 : 1),
                    width: d => xScale(<number>d.value),
                    fill: d => viewModel.settings.generalView.barsColor.solid.color,
                    'fill-opacity': viewModel.settings.generalView.opacity / 100
                });

            let overlapRects = bars.selectAll("rect.overlapBar").data(d => [d]);
                rects.enter()
                    .append('rect')
                    .classed('overlapBar', true);
    
                overlapRects
                    .attr({
                        x: d => BarChart.Config.xScalePadding,
                        y: d => yScale(d.category),
                        height: yScale.rangeBand()/((settings.barShape.shape == "Line" || settings.barShape.shape == "Lollipop" || settings.barShape.shape == "Hammer Head") ? 8 : 1),
                        width: d => xScale(<number>d.overlapValue),
                        fill: d => viewModel.settings.generalView.overlapColor.solid.color,
                        'fill-opacity': viewModel.settings.generalView.opacity / 100
                    });
            
            
            if(settings.barShape.shape =="Lollipop"){
                let circle = bars.selectAll("circle").data(d => [d]);

                circle.enter()
                    .append('circle')
                    .classed('head', true);
    
                    circle
                    .attr({
                        cx: d => getHeadPositionX(d.value,d.width) - 2 - yScale.rangeBand()/8,  
                        cy: d => yScale(d.category) + yScale.rangeBand()/16,// - textMeasurementService.measureSvgTextHeight(textProperties) / 4,
                        r: yScale.rangeBand()/8, 
                        fill: d => viewModel.settings.barShape.headColor.solid.color,
                        'fill-opacity': viewModel.settings.generalView.opacity / 100
                    });
            }
            else{
                bars.selectAll("circle").remove();
            }

            if(settings.barShape.shape =="Hammer Head"){
                let line = bars.selectAll("line").data(d => [d]);

                line.enter()
                    .append('line')
                    .classed('head', true);
    
                    line
                    .attr({
                        x1: d => getHeadPositionX(d.value,d.width) - 7 - yScale.rangeBand()/32,// - 2 - yScale.rangeBand()/8,  
                        x2: d => getHeadPositionX(d.value,d.width) - 7 - yScale.rangeBand()/32,// - 2 - yScale.rangeBand()/8,  
                        y1: d => yScale(d.category) - yScale.rangeBand()/16,// - textMeasurementService.measureSvgTextHeight(textProperties) / 4,
                        y2: d => yScale(d.category) + yScale.rangeBand()/16 + yScale.rangeBand()/8,// - textMeasurementService.measureSvgTextHeight(textProperties) / 4,
                        
                        'stroke-width': yScale.rangeBand()/16,
                        'stroke': viewModel.settings.barShape.headColor.solid.color,
                        'stroke-opacity': viewModel.settings.generalView.opacity / 100
                    });
            }
            else{
                bars.selectAll("line").remove();
            }

            textProperties = {
                text: "TEXT for calculating height",
                fontFamily: "Segoe UI",
                fontSize: fontSizeToUse+'px'
            };
            
            let texts = bars
                .selectAll('text.bar-text').data(d => [d]);
            texts.enter().append('text');
            texts.attr({
                height: yScale.rangeBand(),
                y: d => yScale(d.category) + yScale.rangeBand()/2 + textMeasurementService.measureSvgTextHeight(textProperties)/4,
                x: 5,
                'font-size': fontSizeToUse,
                fill: d => viewModel.settings.generalView.textColor.solid.color
            })
                .classed('bar-text', true)
                .text(d => { return d.category })
                .each(function(d) {
                    d.width = this.getBBox().width;
            });
            if(this.barChartSettings.experimental.show)
                texts.attr("style","mix-blend-mode: "+this.barChartSettings.experimental.blendMode);
            else
            texts.attr("style","mix-blend-mode: initial");
            if(viewModel.settings.showBarLabels.show){

                let textValues = bars
                    .selectAll('text.bar-value').data(d => [d]);
                textValues.enter().append('text');
                textValues.attr({
                    height: yScale.rangeBand(),
                    y: d => getTextPositionY(d.category,textProperties),
                    x: d => getTextPositionX(d.value,d.width),
                    'font-size': fontSizeToUse,
                    fill: d => viewModel.settings.showBarLabels.textColor.solid.color
                })
                    .classed('bar-value', true)
                    .text(d => { return <string>d.formattedValue });
            }
            else{
                let textValues = bars
                .selectAll('text.bar-value').remove();
            }     
            this.tooltipServiceWrapper.addTooltip(this.barContainer.selectAll('.bar'),
                (tooltipEvent: TooltipEventArgs<number>) => this.getTooltipData(tooltipEvent.data),
                (tooltipEvent: TooltipEventArgs<number>) => null);

            let selectionManager = this.selectionManager;

            //This must be an anonymous function instead of a lambda because
            //d3 uses 'this' as the reference to the element that was clicked.
            bars.on('click', function (d) {
                selectionManager.select(d.selectionId).then((ids: ISelectionId[]) => {
                    bars.attr({
                        'fill-opacity': ids.length > 0 ? BarChart.Config.transparentOpacity : BarChart.Config.solidOpacity
                    });
                    rects.attr({
                        'fill-opacity': ids.length > 0 ? BarChart.Config.transparentOpacity : BarChart.Config.solidOpacity
                    });

                    d3.select(this).attr({
                        'fill-opacity': BarChart.Config.solidOpacity
                    });
                    d3.select(this).selectAll('rect').attr({
                        'fill-opacity': BarChart.Config.solidOpacity
                    });

                });

                (<Event>d3.event).stopPropagation();
            });

            bars.exit()
                .remove();
            function getTextPositionX(value,width){
                
                if(settings.barShape.shape == "Bar"){
                    return xScale(<number>value) > width ? xScale(<number>value) + 8 : width + 8;
                }
                else if(settings.barShape.shape == "Line" || settings.barShape.shape == "Lollipop" || settings.barShape.shape == "Hammer Head"){
                    if(settings.barShape.labelPosition=="Top"){
                        return   1.01*(xScale(<number>value) + 8);
                    }else{
                        return  1.01*(width + 8);
                    }
                }
            };
            function getTextPositionY(category,textProperties){
                
                if(settings.barShape.shape == "Bar"){
                    return yScale(category) + yScale.rangeBand() / 2 + textMeasurementService.measureSvgTextHeight(textProperties) / 4;
                }
                else if(settings.barShape.shape == "Line" || settings.barShape.shape == "Lollipop" || settings.barShape.shape == "Hammer Head"){
                    if(settings.barShape.labelPosition=="Top"){
                        return yScale(category) + yScale.rangeBand() / 16 + textMeasurementService.measureSvgTextHeight(textProperties) / 4 ; 
                    }else{
                        return yScale(category) + yScale.rangeBand() / 2 + textMeasurementService.measureSvgTextHeight(textProperties) / 4;
                    }
                }
            };
            function getHeadPositionX(value,width){
                
                if(settings.barShape.shape == "Bar"){
                    return xScale(<number>value) > width ? xScale(<number>value) + 8 : width + 8;
                }
                else if(settings.barShape.shape == "Line" || settings.barShape.shape == "Lollipop" || settings.barShape.shape == "Hammer Head"){
                    
                        return   xScale(<number>value) + 8;
                    
                }
            };
            function getHeadPositionY(category,textProperties){
                
                if(settings.barShape.shape == "Bar"){
                    return yScale(category) + yScale.rangeBand() / 2 + textMeasurementService.measureSvgTextHeight(textProperties) / 4;
                }
                else if(settings.barShape.shape == "Line" || settings.barShape.shape == "Lollipop" || settings.barShape.shape == "Hammer Head"){
                    if(settings.barShape.labelPosition=="Top"){
                        return yScale(category) + yScale.rangeBand() / 16 + textMeasurementService.measureSvgTextHeight(textProperties) / 4 ; 
                    }else{
                        return yScale(category) + yScale.rangeBand() / 2 + textMeasurementService.measureSvgTextHeight(textProperties) / 4;
                    }
                }
            };
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
                
                case 'fontParams':
                    objectEnumeration.push({
                        objectName: objectName,
                        properties: {
                            show: this.barChartSettings.fontParams.show,
                            fontSize: this.barChartSettings.fontParams.fontSize
                        },
                        selector: null
                    });
                    break;
                case 'generalView':
                    objectEnumeration.push({
                        objectName: objectName,
                        properties: {
                            opacity: this.barChartSettings.generalView.opacity,
                            barsColor: this.barChartSettings.generalView.barsColor,
                            overlapColor: this.barChartSettings.generalView.overlapColor,
                            textColor: this.barChartSettings.generalView.textColor
                        },
                        validValues: {
                            minHeight: {
                                numberRange: {
                                    min: 50,
                                    max: 2500
                                }
                            },
                            barHeight: {
                                numberRange: {
                                    min: 20,
                                    max: 200
                                }
                            },
                            opacity: {
                                numberRange: {
                                    min: 10,
                                    max: 100
                                }
                            }
                        },
                        selector: null
                    });
                    break;
                    case 'showBarLabels':
                    objectEnumeration.push({
                        objectName: objectName,
                        properties: {
                            show: this.barChartSettings.showBarLabels.show,
                            textColor: this.barChartSettings.showBarLabels.textColor
                        },
                        selector: null
                    });
                    break;
                    case 'barShape':
                    objectEnumeration.push({
                        objectName: objectName,
                        properties: {
                            shape: this.barChartSettings.barShape.shape,
                            headColor: this.barChartSettings.barShape.headColor,
                            labelPosition: this.barChartSettings.barShape.labelPosition
                        },
                        selector: null
                    });
                    break;
                    case 'barHeight':
                    objectEnumeration.push({
                        objectName: objectName,
                        properties: {
                            show: this.barChartSettings.barHeight.show,
                            height: this.barChartSettings.barHeight.height
                        },
                        validValues: {
                           
                            height: {
                                numberRange: {
                                    min: 20,
                                    max: 200
                                }
                            }
                        },
                        selector: null
                    });
                    break;
                    case 'experimental':
                    objectEnumeration.push({
                        objectName: objectName,
                        properties: {
                            show: this.barChartSettings.experimental.show,
                            blendMode: this.barChartSettings.experimental.blendMode
                        },
                        
                        selector: null
                    });
                    break;
            };

            return objectEnumeration;
        }

        /**
         * Destroy runs when the visual is removed. Any cleanup that the visual needs to
         * do should be done here.
         *
         * @function
         */
        public destroy(): void {
            //Perform any cleanup tasks here
        }

        private getTooltipData(value: any): VisualTooltipDataItem[] {


            let language = getLocalizedString(this.locale, "LanguageKey");
            let tooltip = [];
            
            tooltip.push({
                //header: value.category,
                displayName: value.category,
                value: value.formattedValue,
            });

            value.tooltip.forEach(element => {
                tooltip.push({displayName:element.displayName,value:(typeof(element.value)==="string" ? (element.value || 0).toString() : (this.barChartSettings.units.decimalPlaces != null ? parseFloat(element.value).toFixed(this.barChartSettings.units.decimalPlaces) : element.value))});
            });

            return tooltip;
        }
        private formatLongNumber(value) {
            value = value || 0;
            if (value === 0) {
                return 0;
            }
            else {
                if (value <= 999) {
                    return value.toFixed(2);
                }
                else if (value >= 1000 && value <= 999999) {
                    return (value / 1000).toFixed(2) + " K";
                }
                else if (value >= 1000000 && value <= 999999999) {
                    return (value / 1000000).toFixed(2) + " M";
                }
                else if (value >= 1000000000 && value <= 999999999999) {
                    return (value / 1000000000).toFixed(2) + " B";
                }
                else {
                    return value;
                }
            }
        }
    }
    function getMetadataIndexFor(displayName: any, values: any) {
            var i;

            for (i = 0; i < values.length; i++) {
               
                if (values[i].displayName == displayName){
                    return i;
                }
            }
            return i;
        }
    function getIndexForDataMax(arr){
        var i = 0;
        var p = 0;
        var max = arr[i].value;
        for (i = 1; i<arr.length;i++){

            if(arr[i].value>max){
                max = arr[i].value;
                p=i;
            }
        }
        return p;
    }

    
}
