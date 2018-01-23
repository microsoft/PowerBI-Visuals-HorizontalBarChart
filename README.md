
# Contributing

This project welcomes contributions and suggestions.  Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit https://cla.microsoft.com.

When you submit a pull request, a CLA-bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., label, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.


### Setting Up Environment

Before starting creating your first custom visual follow by [this](https://github.com/Microsoft/PowerBI-visuals/blob/master/Readme.md#setting-up-environment)
setting up environment instruction.


### Install dev dependencies:

Once you have cloned this example, run these commands to install dependencies and to connect the visual into powerbi.

```
npm install # This command will install all necessary modules
typings install # This command will install all neccesary typings
```

### Start dev app
```
pbiviz start
```

### Create the visual package  
```
pbiviz package
```