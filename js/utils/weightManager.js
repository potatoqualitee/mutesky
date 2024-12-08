function getWeightThreshold(categoryWeight, targetCount) {
    switch(targetCount) {
        case 100:
            return categoryWeight === 10 ? 8 :
                   categoryWeight === 9 ? 8 :
                   categoryWeight === 8 ? 8 :
                   categoryWeight === 7 ? 10 : 11;
        case 300:
            return categoryWeight === 10 ? 7 :
                   categoryWeight === 9 ? 7 :
                   categoryWeight === 8 ? 8 :
                   categoryWeight === 7 ? 9 : 11;
        case 500:
            return categoryWeight === 10 ? 4 :
                   categoryWeight === 9 ? 5 :
                   categoryWeight === 8 ? 6 :
                   categoryWeight === 7 ? 7 : 11;
        default:
            return 0;
    }
}

export { getWeightThreshold };
