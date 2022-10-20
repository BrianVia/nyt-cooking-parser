# python file to parse a NYT cooking website recipe and return the ingredients and steps in a json file
import requests


def parse_recipe(url):
    # get the html of the recipe
    r = requests.get(url)
    
    html = r.text

    # print(html)
    
    recipeJson = html.split('<script type="application/ld+json">')[1].split('</script>')[0]
    return recipeJson

def main():
    # url of the recipe to parse
    url = 'https://cooking.nytimes.com/recipes/1020369-crispy-parmesan-eggs?action=click&module=RecipeBox&pgType=recipebox-page&region=breakfast&rank=4'

    # parse the recipe
    recipeJson = parse_recipe(url)
    print(recipeJson)


main()