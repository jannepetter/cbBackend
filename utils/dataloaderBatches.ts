
export const batchUsers = async (keys: any[], User: any) => {
    console.log('userbätsi', keys)
    const users = await User.find({ _id: { '$in': keys } })
    const userMap: { [key: string]:any} = {};
    users.forEach((u:any) => {
      userMap[u.id] = u;
    });
    return keys.map(k => userMap[k]);
}
export const batchRecipes = async (keys: string[], Recipe: any) => {
    console.log('recipebätsi', keys)
    const recipes = await Recipe.find({ _id: { '$in': keys } })
    const recipeMap: { [key: string]:any} = {};
    recipes.forEach((r:any) => {
      recipeMap[r.id] = r;
    });
    return keys.map(k =>recipeMap[k]);
}