---
layout: post
title:  "Autodetection and Classification of Hidden Cultural City Districts from Yelp Reviews"
date:   2015-2-20 05:40:00
categories: machine learning yelp lda
image: 
        feature: VegasGaussian2.png
overlay-alpha: .7
description: Winning the Yelp Dataset Challenge
comments: true
published: false
---
## Intro
Yelp recently ran their 4th Academic Challenge. This post is a summary of the paper that Harini Suresh and I submitted to the challenge. The full paper can be found [here](http://arxiv.org/abs/1501.02527), and all the code is available [here](https://github.com/harinisuresh/yelp-district-clustering).  

The basic setup is that Yelp released an Academic Dataset which includes over 42,000 businesses and oer 1 million reviews, and the challenge is to do something interesting of academic merit. In this study, we used Latent Dirichlet Allocation (LDA) topic modelinng on this massive trove of Yelp reviews to classify restaurants based off of their reviews. Furthermore, we hypothesize that within a city, restaurants can be grouped into similar "clusters" based on both location and similarity. These clusters are the cultural and culinary districts of a city.  

We used several different clustering methods, including K-means Clustering and Probabilistic Mixture Models in order to uncover and classify these districts, both well-known and hidden. These uncovered districts include cultural areas like Chinatown or hearsay like "the best street for Italian restaurants". We use these models to display and label different clusters on a map.  

The point is that many of these implicit boundaries and classifications are not documented on official maps, and usually are only learned with much time and experience living in a particular city. Our algorithm aims to automatically find them from the data.

## METHODS

### Get the data
So first lets load the data so we can train with it.
{% highlight python %}
def load_training_data():
    data = pd.DataFrame.as_matrix(pd.read_csv(TRAINING_SET_PATH))
    Y = data[:, 0]
    data = data[:, 1:] # trim first classification field
    X = normalize_data(data)
    return X, Y

def normalize_data(X):
    return X/255.0
{% endhighlight %}

Here we use the pandas library to load the Kaggle training set into numpy array form. We trim the first field (the actual classification) from X and put it in Y. X is our data and Y is our target. Lastly, we normalize the data by dividing by 255, so our pixel values go from 0-255 to 0-1.

### Image Manipulation
So our training set is too small for our net to generalize well. Because of the data scarcity, it is bound to overfit. So thankfully there is some image properties we can exploit to make the training set larger and more varied. 

First, lets nudge the image in each direction. The net should be able to recognize the same digit regardless of its position, so we shift the digits of our training set around to ensure this.
{% highlight python %}
def nudge_dataset(X, Y):
    nudge_size = 2
    direction_matricies = [
        [[0, 1, 0],
         [0, 0, 0],
         [0, 0, 0]],

        [[0, 0, 0],
         [1, 0, 0],
         [0, 0, 0]],

        [[0, 0, 0],
         [0, 0, 1],
         [0, 0, 0]],

        [[0, 0, 0],
         [0, 0, 0],
         [0, 1, 0]]]

    scaled_direction_matricies = [[[comp*nudge_size for comp in vect] for vect in matrix] for matrix in direction_matricies]
    shift = lambda x, w: convolve(x.reshape((IMAGE_WIDTH, IMAGE_WIDTH)), mode='constant',
                                  weights=w).ravel()
    X = np.concatenate([X] +
                       [np.apply_along_axis(shift, 1, X, vector)
                        for vector in scaled_direction_matricies])

    Y = np.concatenate([Y for _ in range(5)], axis=0)
    return X, Y
{% endhighlight %}
We nudge the image by 2 pixels in each of the 4 cardinal directions: up, left, right, down. Here is a plot of this nudging in action:

<figure>
    <img src="/images/nudged_8.png">
    <figcaption>Original 8, then nudged up, left, right, down</figcaption>
</figure>
This takes our training set from 40,000 examples to 200,000 (5x the size).

Lets do some rotation next.
{% highlight python %}
def rotate_dataset(X, Y):
    rot_X = np.zeros(X.shape)
    for index in range(X.shape[0]):
        sign = random.choice([-1, 1])
        angle = np.random.randint(8, 16)*sign
        rot_X[index, :] = threshold(nd.rotate(np.reshape(X[index, :],
            ((28, 28))), angle, reshape=False).ravel())
    XX = np.vstack((X,rot_X))
    YY = np.hstack((Y,Y))
    return XX, YY
{% endhighlight %}
We rotate each digit by a random rotation from 8-16 degrees in each direction. Unfortunately, after the rotation, there is a resampling of the image that alters the pixel values of the background and washes out extreme values. This issue is shown here.
<figure>
    <img src="/images/rotated_digits.png">
    <figcaption>Original 8 compared with rotated 8. Notice the new gray background color</figcaption>
</figure>
We solve this by thresholding the pixel values.
{% highlight python %}
def threshold(X):
    X[X < 0.15] = 0.0
    X[X >= 0.85] = 1.0
    return X
{% endhighlight %}
This resolves the issue and the background returns to white.
<figure>
    <img src="/images/rotated_and_thresholded_digits.png">
    <figcaption>Rotated digits with threshold</figcaption>
</figure>

### Training & Prediction
Lets make our neural net, train with our augmented training data, and do some prediction.

{% highlight python %}
def run():
    X_train, Y_train = load_training_data()
    
    X_train, Y_train = rotate_dataset(X_train, Y_train)
    X_train, Y_train = nudge_dataset(X_train, Y_train)

    n_features = X_train.shape[1]
    n_classes = 10
    classifier = DBN([n_features, 8000, n_classes], 
        learn_rates=0.3, learn_rate_decays=0.9, epochs=80, verbose=1)

    classifier.fit(X_train, Y_train)

    test_data = get_test_data_set()
    predictions = classifier.predict(test_data)
    write_to_csv(predictions)
{% endhighlight %}

We use nolearn's implementation of a Deep Belief Network. The net is shallow but wide. Training of this net took about 20 hours to complete. Each epoch took around 16 minutes. But by epoch 40, the error rate was e < 0.005, so its probably possible to get pretty good results in in half the time with a lower epoch.

NOTE: I re-ran this on my GPU via [cuda](https://developer.nvidia.com/cuda-downloads), and reduced training time significantly. Each epoch only took around 4 minutes, with total training taking about 5 hours.

Enjoy!
