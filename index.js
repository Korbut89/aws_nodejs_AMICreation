const AWS = require('aws-sdk')
const DateDiff = require('date-diff');

AWS.config.loadFromPath('./config.json')

retention_period = 7
today = new Date()

var ec2 = new AWS.EC2({apiVersion: '2016-11-15'})

function main(){
    var instanceParams = {
        IncludeAllInstances: true
     };
    ec2.describeInstanceStatus(instanceParams,function(err, data){
        if(err){
            console.log(err, err.stack)
        }
        else
            for(index in data['InstanceStatuses']){
                var  instance =  data['InstanceStatuses'][index]
              
                if(instance.InstanceState.Name=='running'){
                    var params = {
                        Filters: [
                           {
                          Name: "resource-id", 
                          Values: [
                             instance.InstanceId
                          ]
                         }
                        ]
                    };

                    ec2.describeTags(params, function(err, tag_data) {
                        if (err) console.log(err, err.stack);
                        else  
                            for(e in tag_data){
                                for (i in tag_data[e]){
                                    if(tag_data[e][i].Key == 'Retention'){  
                                        Backups_checker(tag_data[e][i].ResourceId,tag_data[e][i].Value)
                                    }
                                    if(tag_data[e][i].Key == 'Backup' && tag_data[e][i].Value == 'true'){
                                        console.log('Creating AMI for the instance: '+tag_data[e][i].ResourceId)
                                        create_image(tag_data[e][i].ResourceId,Date.now())
                                    }  
                                }
                            }
                    });
                }
                else
                    console.log("WARNING - "+instance.InstanceId+" DOWN\n")
            }
    })  
}

function Backups_checker(instance,retention_period){
    var params = {
        Filters:[{
            Name:'tag:instance',
            Values:[instance]
        }]
    };

    ec2.describeImages(params,function(err,data){
        if(err){
            console.log(err, err.stack)
        }
        else
            if(data.Images.length != 0){
                for(e in data.Images){
                    creation_date = new Date(data.Images[e].CreationDate)
                    diference = new DateDiff(today,creation_date)
                    AMI_ID = data.Images[e].ImageId
                    if(diference > retention_period){
                        console.log("INFO - AMI|"+AMI_ID+" |Instance "+instance+"| Creation Day "+diference.days())
                        deregister_image(data.Images[e].ImageId)
                    }
                    else
                        console.log("INFO - AMI|"+AMI_ID+" |Instance "+instance+"| Creation Day "+diference.days())  
                }
            }
    })
}

function create_image(instance,today){
    var params = {
        InstanceId: instance,
        Name: instance+'-'+today,
        NoReboot: true,
        Description: 'Instance: '+instance
    }
    ec2.createImage(params,function(err,data){
        if(err){
            console.log(err, err.stack)
        }
        else
            console.log(data)
    })
}
function deregister_image(image){
    console.log('Deregistering AMI: '+image)
    var params = {
        ImageId: image, 
        
      };
      ec2.deregisterImage(params, function(err, data) {
        if (err) console.log(err, err.stack);
        else     console.log(data);
      });
}

main()